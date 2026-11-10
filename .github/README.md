# CI/CD for ftrgroup.in

Every push and pull request runs the gates below. **Each gate runs only when a file it checks has changed** (the `changes` job decides; see the table). Skipped gates count as passed. Secret scanning always runs, and a manual run (*Actions → CI → Run workflow*) runs everything. A push to `main` that changes the site deploys to Cloudflare only after every gate that ran has passed, and then production is verified.

## Pipelines

| Workflow | When | What it checks |
|---|---|---|
| **CI** (`ci.yml`) | Push, pull request, manual | Everything below, then a gated deploy |
| ↳ `quality` | site, Worker, scripts, tests, configs | ESLint, Stylelint, html-validate (HTML and accessibility rules), cspell (British English), `check-site`, Worker tests, `wrangler deploy --dry-run`, retire.js |
| ↳ `grammar` | pages, `llms.txt`, Worker Markdown, dictionary | LanguageTool 6.6 (en-GB, picky) on every page, alt text, meta and social descriptions, `llms.txt` and the Worker's Markdown view; enforces -ise house spelling |
| ↳ `e2e` | site, tests, Playwright config | Playwright in Chrome, Firefox, Android Chrome and iPhone Safari against `wrangler dev`: no console errors, CSP violations, failed requests or broken images; no sideways scrolling; axe WCAG 2.1 AA in dark and light themes; menu, accordion, toggles, links; Worker headers, 405s, Markdown and 404. Chrome also sweeps **16 screen sizes** (320px phones to 2560px, landscape phones, iPads): no overflow or cut-off elements, tap targets at least 24px (WCAG 2.5.8), at least 60% of text 12px or larger, no stretched images, layout shift under 0.1 and largest paint under 2.5s |
| ↳ `secrets` | always | gitleaks and TruffleHog on the new commits |
| ↳ `dependencies` | `package.json`, lockfile | `npm audit`, npm registry signatures, dependency review (vulnerabilities and licences) on pull requests |
| ↳ `workflows` | `.github/` | actionlint and zizmor on the workflows themselves |
| ↳ `deploy` | site changed on `main`, opt-in | `wrangler deploy`, then `check-live --expect-current` and real-browser tests against https://ftrgroup.in |
| **CodeQL** (`codeql.yml`) | JS or workflow changes, weekly | Security analysis of the JavaScript and the workflows |
| **Production monitor** (`monitor.yml`) | Daily 08:47 IST, manual | Live headers, HTTPS redirect, pages, assets, TLS expiry, drift from `main`; real-browser test of production; every link on the live pages; secret scan of the full git history; `npm audit` and retire.js for newly published advisories |

`check-site` is the release gate for `dist/`. It fails on broken links, anchors and assets; anything the CSP would block (inline scripts, styles and handlers, third-party resources, `fetch`); forms and embeds; links that redirect (`/privacy.html` → `/privacy`); secrets, private keys, local URLs and file paths; any email or phone number that is not the published contact; hidden, archive, office, key or source-map files; missing SEO basics; sitemap and robots mistakes; and files over Cloudflare's 25 MiB limit. It warns about unreferenced public files and out-of-date years.

## One-time setup

1. **Turn on deploys.** In *Settings → Secrets and variables → Actions*:
   - Secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token from the *Edit Cloudflare Workers* template, limited to this account and zone.
   - Secret `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.
   - Variable `CLOUDFLARE_DEPLOY` = `true`.

   Until the variable is set, CI runs every check but does not deploy.
2. **Protect production.** In *Settings → Environments*, open `production` (CI creates it on the first deploy) and limit it to the `main` branch. Add yourself as a required reviewer if you want to approve each deploy.
3. **Protect `main`.** In *Settings → Rules → Rulesets*, require a pull request and these status checks: every `CI` job except `deploy`. Do not require `CodeQL`: it only runs when code changes, so a pull request without code changes would wait for it forever. Block force pushes.
4. **Turn on GitHub's own scanning.** In *Settings → Advanced Security*: Dependabot alerts, secret scanning and **push protection**, so a secret is rejected before it reaches GitHub.

## Run the checks locally

```sh
npm ci
npm run check          # lint, spelling, site gate, unit tests, Worker build
npx playwright install # once
npm run test:e2e       # browser tests against wrangler dev
LANGUAGETOOL_URL=https://api.languagetool.org npm run grammar
npm run check:live     # read-only checks of https://ftrgroup.in
```

`npm run deploy` runs `npm run check` first, so a local deploy cannot skip the gate.

## When a check fails

- **Spelling:** fix the word. If it is a correct name or term, add it to `.cspell/project-words.txt`.
- **Grammar:** fix the sentence. If LanguageTool is wrong, add `{ rule, text, reason }` to `GRAMMAR.ignore` in `scripts/site.config.mjs`.
- **Contact details:** a new public email or phone number goes in `ALLOWED_EMAILS` or `ALLOWED_PHONES` in `scripts/site.config.mjs`.
- **Unreferenced file:** delete it from `dist/`, or link it from a page. Files in `LEGACY_UNREFERENCED` only warn; delete them when you can, because they are still public.
- **CSP violation:** move the inline code to a file in `dist/`. If a new third-party service is really needed, change the CSP in both `src/index.js` and `dist/_headers`. The Worker tests fail if the two differ or if the policy is weakened.
- **Browser test:** download the `playwright-*` artifact from the failed run and open `playwright-report/index.html`, or run `npx playwright show-trace` on a trace.
