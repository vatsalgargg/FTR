// Release gate for the public site: broken references, CSP compliance, leaks, SEO basics and Cloudflare limits.
// It checks the files on disk under dist/, because that is exactly what `wrangler deploy` uploads.
// cspell:ignore abprs passw rels bnoopener bnoreferrer noopener ovpn kdbx vibecode licen AKIA pousr bxox
import { readFile, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parse } from "parse5";
import * as config from "./site.config.mjs";
import { createReporter } from "./lib/report.mjs";

const report = createReporter("check-site");
const PUBLIC = process.env.SITE_DIR ?? config.PUBLIC_DIR;
const ORIGIN = new URL(config.SITE_ORIGIN).origin;
const LEGACY = new Set(config.LEGACY_UNREFERENCED);
const TEXT_EXT = /\.(html|css|js|mjs|txt|xml|json|svg|md|webmanifest)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif)$/i;

const toPosix = p => p.split(path.sep).join("/");
const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const isVendor = file => file.startsWith(`${PUBLIC}/vendor/`) || file.endsWith(".min.js") || file.endsWith(".min.css");
const isLicense = file => /licen[cs]e/i.test(path.basename(file));

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(toPosix(full));
  }
  return files;
}

// ---------------------------------------------------------------- deployed file set

const ignorePatterns = (await readFile(`${PUBLIC}/.assetsignore`, "utf8").catch(() => ""))
  .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
const isAssetIgnored = rel => ignorePatterns.some(pattern =>
  [pattern, `**/${pattern}`, `${pattern.replace(/\/$/, "")}/**`].some(glob => path.matchesGlob(rel, glob)));

const files = (await walk(PUBLIC)).filter(file => !isAssetIgnored(file.slice(PUBLIC.length + 1)));
const fileSet = new Set(files);
const texts = new Map();
const readText = async file => {
  if (!texts.has(file)) texts.set(file, await readFile(file, "utf8"));
  return texts.get(file);
};

const urlForFile = file => new URL(file.slice(PUBLIC.length), ORIGIN);
// Cloudflare's asset handling serves /privacy.html with a 307 to /privacy, so the clean URL is the real one.
const canonicalUrlFor = file => urlForFile(file).href.replace(/\/index\.html$/, "/").replace(/\.html$/, "");

function fileForPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const base = `${PUBLIC}${decoded}`;
  const candidates = decoded.endsWith("/") ? [`${base}index.html`] : [base, `${base}.html`, `${base}/index.html`];
  return candidates.find(candidate => fileSet.has(candidate)) ?? null;
}

function classify(raw, base) {
  const value = raw.trim();
  if (value === "") return { type: "empty" };
  if (/^mailto:/i.test(value)) return { type: "mailto", value: value.slice(7) };
  if (/^tel:/i.test(value)) return { type: "tel", value: value.slice(4) };
  if (/^data:/i.test(value)) return { type: "data" };
  if (/^javascript:/i.test(value)) return { type: "javascript" };
  let url;
  try { url = new URL(value, base); } catch { return { type: "invalid" }; }
  return url.origin === ORIGIN ? { type: "local", url } : { type: "external", url };
}

// ---------------------------------------------------------------- contact data and leaks

const allowedEmails = new Set(config.ALLOWED_EMAILS.map(email => email.toLowerCase()));
const allowedPhones = new Set(config.ALLOWED_PHONES);
const normalisePhone = value => value.replace(/[^\d+]/g, "");

function checkEmail(file, line, email) {
  if (!allowedEmails.has(email.toLowerCase())) {
    report.error(file, line, `Email "${email}" is not in ALLOWED_EMAILS (scripts/site.config.mjs). Fix the typo, or add it if it is meant to be public.`);
  }
}

function checkPhone(file, line, phone) {
  if (!allowedPhones.has(normalisePhone(phone))) {
    report.error(file, line, `Phone "${phone}" is not in ALLOWED_PHONES (scripts/site.config.mjs). Fix the typo, or add it if it is meant to be public.`);
  }
}

const SECRET_PATTERNS = [
  [/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/, "a private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key ID"],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/, "a GitHub token"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "a Google API key"],
  [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/, "a Stripe key"],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/, "an API secret key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "a JSON Web Token"],
];
const FIRST_PARTY_SECRET = /\b(?:api[_-]?key|secret|passw(?:or)?d|auth[_-]?token|access[_-]?token|bearer)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i;
const INTERNAL_PATTERNS = [
  [/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/i, "a local development URL"],
  [/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/, "a private network address"],
  [/\bfile:\/\//i, "a file:// URL"],
  [/\b[A-Za-z]:\\(?:Users|Documents and Settings)\\|\/(?:Users|home)\/[A-Za-z0-9._-]+\//, "a local file-system path"],
];
const SENSITIVE_COMMENT = /\b(?:passw(?:or)?d|secret|token|api[-_ ]?key|credentials?|confidential|internal only|do not (?:publish|deploy|share))\b/i;
const TODO_COMMENT = /\b(?:TODO|FIXME|XXX|HACK)\b/;

function checkComment(file, line, comment) {
  if (SENSITIVE_COMMENT.test(comment)) report.error(file, line, `Public comment may expose internal information: "${comment.trim().slice(0, 80)}"`);
  else if (TODO_COMMENT.test(comment)) report.warn(file, line, `Public comment contains a work note: "${comment.trim().slice(0, 80)}"`);
}

function scanContent(file, text, { firstParty }) {
  for (const [pattern, label] of SECRET_PATTERNS) {
    const match = pattern.exec(text);
    if (match) report.error(file, lineAt(text, match.index), `Possible secret: looks like ${label}. Revoke it and remove it from the repository history.`);
  }
  if (!firstParty) return;
  const credential = FIRST_PARTY_SECRET.exec(text);
  if (credential) report.error(file, lineAt(text, credential.index), "Possible hard-coded credential. Store secrets with `wrangler secret put`, never in public files.");
  for (const [pattern, label] of INTERNAL_PATTERNS) {
    const match = pattern.exec(text);
    if (match) report.error(file, lineAt(text, match.index), `Public file contains ${label}: "${match[0]}"`);
  }
  if (!/\.(css|js|mjs)$/.test(file)) {
    for (const match of text.matchAll(/(?<![\w.%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w-])/g)) {
      checkEmail(file, lineAt(text, match.index), match[0]);
    }
    for (const match of text.replace(/&nbsp;|&#160;|&#xa0;/gi, " ").matchAll(/\+91[\s.-]*\d(?:[\s.-]*\d){9}/g)) {
      checkPhone(file, lineAt(text, match.index), match[0]);
    }
    const year = new Date().getFullYear();
    for (const match of text.matchAll(/(?:©|&copy;)\s*(\d{4})/g)) {
      if (Number(match[1]) < year) report.warn(file, lineAt(text, match.index), `Copyright year ${match[1]} is out of date; it is now ${year}.`);
    }
    for (const match of text.matchAll(/\b(\d+)\+?\s+years of service/gi)) {
      if (Number(match[1]) !== year - config.FOUNDED_YEAR) {
        report.warn(file, lineAt(text, match.index), `"${match[0]}" is out of date: FTR was founded in ${config.FOUNDED_YEAR}, so it is now ${year - config.FOUNDED_YEAR} years.`);
      }
    }
  }
  if (/\.(js|css)$/.test(file)) {
    const map = /sourceMappingURL=(\S+)/.exec(text);
    if (map) report.warn(file, lineAt(text, map.index), `References a source map (${map[1]}). Remove the comment, or the browser requests a missing file.`);
  }
}

// ---------------------------------------------------------------- HTML

function* nodes(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* nodes(child);
  if (node.content) yield* nodes(node.content);
}
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const lineOf = (node, name) => (name && node.sourceCodeLocation?.attrs?.[name]?.startLine) || node.sourceCodeLocation?.startLine;
const textOf = node => (node.childNodes ?? []).map(child => (child.nodeName === "#text" ? child.value : textOf(child))).join("");
const NAVIGATIONAL_RELS = new Set(["canonical", "alternate", "author", "help", "license", "next", "prev", "search"]);
const SOCIAL_MEDIA_KEYS = new Set(["og:image", "og:image:url", "og:image:secure_url", "og:video", "og:audio", "twitter:image"]);

const pages = new Map();

async function analysePage(file) {
  const html = await readText(file);
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const page = { file, ids: new Set(), refs: [], robots: "", canonical: null, title: null, description: null, lang: null, h1: 0, viewport: false };
  const addRef = (node, name, raw, kind) => page.refs.push({ raw, kind, line: lineOf(node, name), tag: node.tagName });

  for (const node of nodes(doc)) {
    if (node.nodeName === "#comment") { checkComment(file, node.sourceCodeLocation?.startLine, node.data); continue; }
    if (!node.tagName) continue;
    const tag = node.tagName;
    if (attr(node, "id")) page.ids.add(attr(node, "id"));
    if (tag === "a" && attr(node, "name")) page.ids.add(attr(node, "name"));

    for (const { name, value } of node.attrs) {
      if (/^on/i.test(name)) report.error(file, lineOf(node, name), `Inline event handler "${name}" is blocked by the CSP (script-src 'self'). Attach the listener from a script file.`);
      if (name === "style") report.error(file, lineOf(node, name), "Inline style attribute is blocked by the CSP (style-src 'self'). Move it to a stylesheet.");
      if (/^\s*javascript:/i.test(value)) report.error(file, lineOf(node, name), `javascript: URL in ${name} is blocked by the CSP and is an XSS risk.`);
    }

    switch (tag) {
      case "html": page.lang = attr(node, "lang"); break;
      case "title": page.title = textOf(node).trim(); break;
      case "h1": page.h1++; break;
      case "script": {
        const src = attr(node, "src");
        if (src) { addRef(node, "src", src, "resource"); break; }
        const type = (attr(node, "type") || "").toLowerCase();
        if (type !== "application/ld+json") {
          report.error(file, lineOf(node), "Inline <script> is blocked by the CSP (script-src 'self'). Move it to a .js file.");
          break;
        }
        try {
          const data = JSON.parse(textOf(node));
          if (!/schema\.org/.test(JSON.stringify(data["@context"] ?? ""))) report.error(file, lineOf(node), "JSON-LD block has no schema.org @context.");
          // "@id" values are node identifiers, not links, so only the other URLs must resolve.
          JSON.stringify(data, (key, value) => {
            if (key !== "@id" && typeof value === "string" && value.startsWith(ORIGIN)) addRef(node, null, value.split("#")[0], "resource");
            return value;
          });
        } catch (error) {
          report.error(file, lineOf(node), `Invalid JSON-LD: ${error.message}`);
        }
        break;
      }
      case "style": report.error(file, lineOf(node), "<style> block is blocked by the CSP (style-src 'self'). Move the rules to a stylesheet."); break;
      case "link": {
        const rels = (attr(node, "rel") || "").toLowerCase().split(/\s+/);
        const href = attr(node, "href");
        if (href == null) break;
        if (rels.includes("canonical")) page.canonical = { value: href, line: lineOf(node, "href") };
        addRef(node, "href", href, rels.some(rel => NAVIGATIONAL_RELS.has(rel)) ? "navigate" : "resource");
        break;
      }
      case "a":
      case "area": {
        const href = attr(node, "href");
        if (href != null) addRef(node, "href", href, "navigate");
        if (attr(node, "target") === "_blank" && !/\bnoopener\b|\bnoreferrer\b/i.test(attr(node, "rel") || "")) {
          report.error(file, lineOf(node, "target"), 'target="_blank" needs rel="noopener" so the new page cannot control this one.');
        }
        break;
      }
      case "iframe":
      case "embed":
      case "object":
      case "frame":
        report.error(file, lineOf(node), `<${tag}> embeds are not allowed: the CSP sets object-src 'none' and only allows same-origin content.`);
        break;
      case "form":
        report.error(file, lineOf(node), "<form> is blocked by the CSP (form-action 'none'). SECURITY.md requires a server-side release gate before collecting visitor data.");
        break;
      case "meta": {
        const key = (attr(node, "property") || attr(node, "name") || "").toLowerCase();
        const content = attr(node, "content") ?? "";
        if (key === "robots") page.robots = content.toLowerCase();
        if (key === "description") page.description = { value: content.trim(), line: lineOf(node) };
        if (key === "viewport") page.viewport = true;
        if (SOCIAL_MEDIA_KEYS.has(key)) addRef(node, "content", content, "resource");
        if (key === "og:url") addRef(node, "content", content, "navigate");
        break;
      }
    }
    if (["img", "source", "video", "audio", "track", "input"].includes(tag)) {
      for (const name of ["src", "poster"]) if (attr(node, name)) addRef(node, name, attr(node, name), "resource");
      for (const candidate of (attr(node, "srcset") || "").split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) addRef(node, "srcset", url, "resource");
      }
    }
  }
  pages.set(file, page);
  return page;
}

function checkPageMeta(page) {
  const { file } = page;
  const indexable = !/\bnoindex\b/.test(page.robots);
  if (!page.lang) report.error(file, 1, "<html> has no lang attribute.");
  if (!page.viewport) report.error(file, 1, "No <meta name=\"viewport\">. The page will not scale on phones.");
  if (!page.title) report.error(file, 1, "No <title>.");
  else if (page.title.length > 70) report.warn(file, 1, `<title> is ${page.title.length} characters; search results cut it after about 60-70.`);
  if (!page.description?.value) report.error(file, 1, "No meta description.");
  else if (page.description.value.length < 50 || page.description.value.length > 160) {
    report.warn(file, page.description.line, `Meta description is ${page.description.value.length} characters; aim for 50-160.`);
  }
  if (page.h1 !== 1) report.error(file, 1, `Page has ${page.h1} <h1> elements; it needs exactly one.`);
  if (path.basename(file) === "404.html" && indexable) report.error(file, 1, "The 404 page must have <meta name=\"robots\" content=\"noindex\">.");
  if (indexable && path.basename(file) !== "404.html") {
    const expected = canonicalUrlFor(file);
    if (!page.canonical) report.error(file, 1, `Indexable page has no canonical link. Expected ${expected}.`);
    else if (new URL(page.canonical.value, urlForFile(file)).href !== expected) {
      report.error(file, page.canonical.line, `Canonical URL is ${page.canonical.value}; expected ${expected}.`);
    }
  }
}

// ---------------------------------------------------------------- CSS and JS

async function cssRefs(file) {
  const css = await readText(file);
  const refs = [];
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]*?)\1\s*\)|@import\s+(['"])([^'"]+)\3/g)) {
    const raw = (match[2] ?? match[4]).trim();
    if (raw && !raw.startsWith("#") && !/^data:/i.test(raw)) refs.push({ raw, kind: "resource", line: lineAt(css, match.index), tag: "css" });
  }
  for (const match of css.matchAll(/\/\*[\s\S]*?\*\//g)) checkComment(file, lineAt(css, match.index), match[0]);
  return refs;
}

async function jsRefs(file) {
  const js = await readText(file);
  if (isVendor(file)) return [];
  const network = /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bnew\s+EventSource\b|\bsendBeacon\s*\(|\bimportScripts\s*\(/.exec(js);
  if (network) report.error(file, lineAt(js, network.index), `"${network[0]}" is blocked by the CSP (connect-src 'none'). Update the CSP in src/index.js and dist/_headers first.`);
  const refs = [];
  for (const match of js.matchAll(/(['"`])(\/(?:assets|vendor)\/[^'"`\s$]*)\1/g)) {
    const target = `${PUBLIC}${match[2]}`;
    const line = lineAt(js, match.index);
    if (fileSet.has(target)) refs.push({ file: target, line });
    else {
      const prefixed = files.filter(candidate => candidate.startsWith(target));
      if (prefixed.length) prefixed.forEach(candidate => refs.push({ file: candidate, line }));
      else report.error(file, line, `Script references "${match[2]}", but no file in ${PUBLIC}/ matches it.`);
    }
  }
  return refs;
}

// ---------------------------------------------------------------- reference resolution and reachability

const externalLinks = new Set();

function resolveRefs(file, refs, base) {
  const targets = [];
  for (const ref of refs) {
    const result = classify(ref.raw, base);
    switch (result.type) {
      case "empty":
        report.error(file, ref.line, `Empty URL on <${ref.tag}>.`);
        break;
      case "invalid":
        report.error(file, ref.line, `Invalid URL "${ref.raw}".`);
        break;
      case "mailto":
        for (const address of decodeURIComponent(result.value.split("?")[0]).split(",")) checkEmail(file, ref.line, address.trim());
        break;
      case "tel":
        checkPhone(file, ref.line, result.value);
        break;
      case "external":
        if (ref.kind === "resource") {
          report.error(file, ref.line, `Loads ${result.url.href} from another origin. The CSP only allows 'self', so the browser blocks it. Self-host the file in ${PUBLIC}/.`);
        } else externalLinks.add(result.url.href);
        break;
      case "local": {
        const target = fileForPath(result.url.pathname);
        if (!target) {
          report.error(file, ref.line, `Broken reference: "${ref.raw}" has no matching file in ${PUBLIC}/.`);
          break;
        }
        if (/\.html(?:[?#]|$)/.test(ref.raw)) {
          const clean = canonicalUrlFor(target).slice(ORIGIN.length) + result.url.hash;
          report.error(file, ref.line, `"${ref.raw}" redirects (307) to "${clean}" on Cloudflare. Link to "${clean}" instead.`);
        }
        targets.push({ file: target, hash: result.url.hash, line: ref.line, raw: ref.raw });
        break;
      }
    }
  }
  return targets;
}

const edges = new Map();

async function outgoing(file) {
  if (edges.has(file)) return edges.get(file);
  let targets = [];
  if (file.endsWith(".html")) {
    const page = pages.get(file) ?? await analysePage(file);
    targets = resolveRefs(file, page.refs, canonicalUrlFor(file));
  } else if (file.endsWith(".css")) {
    targets = resolveRefs(file, await cssRefs(file), urlForFile(file));
  } else if (file.endsWith(".js")) {
    targets = await jsRefs(file);
  } else if (/\.(txt|md)$/.test(file) || file.includes("/.well-known/")) {
    const text = await readText(file);
    const refs = [...text.matchAll(/https?:\/\/[^\s)>\]"'`]+/g)]
      .filter(match => match[0].startsWith(ORIGIN))
      .map(match => ({ raw: match[0].replace(/[.,;:]+$/, ""), kind: "navigate", line: lineAt(text, match.index), tag: "link" }));
    targets = resolveRefs(file, refs, ORIGIN);
  }
  edges.set(file, targets);
  return targets;
}

// ---------------------------------------------------------------- crawler files

const sitemapPages = [];

async function checkSitemap() {
  const file = `${PUBLIC}/sitemap.xml`;
  if (!fileSet.has(file)) return report.error(file, null, "sitemap.xml is missing.");
  const xml = await readText(file);
  const stack = [];
  for (const match of xml.matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match;
    if (selfClosing) continue;
    if (!closing) stack.push(name);
    else if (stack.pop() !== name) return report.error(file, lineAt(xml, match.index), `Malformed XML: unexpected </${name}>.`);
  }
  if (stack.length) report.error(file, null, `Malformed XML: <${stack.at(-1)}> is never closed.`);

  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const line = lineAt(xml, match.index);
    const result = classify(match[1], ORIGIN);
    const target = result.type === "local" ? fileForPath(result.url.pathname) : null;
    if (!target || !target.endsWith(".html")) { report.error(file, line, `Sitemap URL ${match[1]} does not map to a page in ${PUBLIC}/.`); continue; }
    if (canonicalUrlFor(target) !== match[1]) report.error(file, line, `Sitemap URL ${match[1]} should be the canonical ${canonicalUrlFor(target)}.`);
    sitemapPages.push(target);
  }
  const tomorrow = Date.now() + 86400000;
  for (const match of xml.matchAll(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/g)) {
    const time = Date.parse(match[1]);
    if (Number.isNaN(time) || time > tomorrow) report.error(file, lineAt(xml, match.index), `Invalid or future <lastmod> ${match[1]}.`);
  }
}

async function checkRobots() {
  const file = `${PUBLIC}/robots.txt`;
  if (!fileSet.has(file)) return report.error(file, null, "robots.txt is missing.");
  const lines = (await readText(file)).split(/\r?\n/);
  let wildcard = false;
  let hasSitemap = false;
  lines.forEach((raw, index) => {
    const line = raw.replace(/#.*/, "").trim();
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(field)) wildcard = value === "*";
    if (wildcard && /^disallow$/i.test(field) && value === "/") report.error(file, index + 1, "robots.txt blocks every crawler from the whole site (Disallow: /).");
    if (/^sitemap$/i.test(field)) {
      hasSitemap = true;
      const result = classify(value, ORIGIN);
      if (result.type !== "local" || !fileForPath(result.url.pathname)) report.error(file, index + 1, `Sitemap ${value} does not exist in ${PUBLIC}/.`);
    }
  });
  if (!hasSitemap) report.error(file, null, "robots.txt has no Sitemap line.");
}

async function checkJsonFiles() {
  for (const file of files.filter(f => f.endsWith(".json") || f.startsWith(`${PUBLIC}/.well-known/api-catalog`))) {
    try { JSON.parse(await readText(file)); } catch (error) { report.error(file, null, `Invalid JSON: ${error.message}`); }
  }
}

// ---------------------------------------------------------------- repository and deploy hygiene

const FORBIDDEN_FILES = [
  [/(^|\/)\.env(\.(?!example$)[^/]+)?$/, "an environment file"],
  [/(^|\/)\.dev\.vars(\.(?!example$)[^/]+)?$/, "a Wrangler secrets file"],
  [/\.(pem|key|p12|pfx|jks|keystore|ppk|ovpn|kdbx|crt|cer|der)$/i, "a key or certificate file"],
  [/(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/, "an SSH key"],
  [/(^|\/)\.npmrc$/, "an npm config file that can hold an auth token"],
  [/\.(zip|7z|rar|tar|tgz|gz|bz2)$/i, "an archive"],
  [/\.(pptx?|docx?|xlsx?|odt|ods|odp|psd|ai|sketch|fig)$/i, "a source or office document"],
  [/\.(log|sqlite3?|db|bak|swp|tmp|orig)$/i, "a log, database or backup file"],
  [/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i, "an operating-system metadata file"],
  [/(^|\/)(node_modules|\.wrangler|\.vibecode-security|\.sites-runtime|qa|source)\//, "a local working directory"],
];
const REQUIRED_GITIGNORE = [".env", ".dev.vars", "node_modules/", ".wrangler/", "*.zip"];

async function checkRepository() {
  let tracked = [];
  try {
    tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  } catch {
    report.warn(null, null, "Not a git checkout; skipped the tracked-file checks.");
  }
  for (const file of new Set([...tracked, ...files])) {
    for (const [pattern, label] of FORBIDDEN_FILES) {
      if (pattern.test(file)) report.error(file, null, `${fileSet.has(file) ? "Deployed" : "Tracked"} file is ${label}. Remove it${fileSet.has(file) ? ` from ${PUBLIC}/` : " from git"} and add it to .gitignore.`);
    }
    if (file.endsWith(".map") && file.startsWith(`${PUBLIC}/`)) report.error(file, null, "Source map would be deployed publicly and expose the original source.");
  }
  for (const file of files) {
    const rel = file.slice(PUBLIC.length + 1);
    if (/(^|\/)\./.test(rel) && !rel.startsWith(".well-known/") && rel !== ".assetsignore") {
      report.error(file, null, "Hidden file would be deployed publicly. Remove it or list it in dist/.assetsignore.");
    }
  }
  const gitignore = await readFile(".gitignore", "utf8").catch(() => "");
  const entries = new Set(gitignore.split(/\r?\n/).map(line => line.trim()));
  for (const entry of REQUIRED_GITIGNORE) {
    if (!entries.has(entry) && !entries.has(entry.replace(/\/$/, "")) && !entries.has(`${entry}*`) && !entries.has(`${entry}.*`)) {
      report.error(".gitignore", null, `.gitignore must ignore "${entry}" so local secrets and build state cannot be committed.`);
    }
  }
}

async function checkLimits(reachable) {
  if (files.length > config.MAX_ASSET_COUNT) report.error(PUBLIC, null, `${files.length} files exceed the Cloudflare limit of ${config.MAX_ASSET_COUNT}.`);
  for (const file of files) {
    const { size } = await stat(file);
    const mib = (size / 1048576).toFixed(1);
    if (size > config.MAX_ASSET_BYTES) report.error(file, null, `${mib} MiB exceeds the Cloudflare static asset limit of 25 MiB; the deploy will fail.`);
    else if (IMAGE_EXT.test(file) && size > config.WARN_IMAGE_BYTES && reachable.has(file)) report.warn(file, null, `Image is ${mib} MiB. Compress it or serve a smaller rendition.`);
  }
}

// ---------------------------------------------------------------- run

await checkRepository();
await checkSitemap();
await checkRobots();
await checkJsonFiles();

for (const file of files.filter(f => f.endsWith(".html"))) checkPageMeta(await analysePage(file));

const indexable = [...pages.values()].filter(page => !/\bnoindex\b/.test(page.robots) && path.basename(page.file) !== "404.html");
for (const page of indexable) {
  if (!sitemapPages.includes(page.file) && !LEGACY.has(page.file)) report.error(page.file, 1, "Indexable page is missing from sitemap.xml.");
}

const roots = [`${PUBLIC}/index.html`, ...sitemapPages, ...config.CONVENTIONAL_FILES].filter(file => fileSet.has(file));
const reachable = new Set(roots);
const queue = [...roots];
while (queue.length) {
  const file = queue.shift();
  for (const target of await outgoing(file)) {
    if (target.hash && target.hash !== "#" && target.hash !== "#top" && target.file.endsWith(".html")) {
      const page = pages.get(target.file) ?? await analysePage(target.file);
      const id = decodeURIComponent(target.hash.slice(1));
      if (!page.ids.has(id)) report.error(file, target.line, `Broken anchor: "${target.raw}" points to #${id}, which does not exist in ${target.file}.`);
    }
    if (!reachable.has(target.file)) {
      reachable.add(target.file);
      queue.push(target.file);
    }
  }
}

for (const file of files) {
  if (!TEXT_EXT.test(file) && !file.startsWith(`${PUBLIC}/.well-known/`) && !file.endsWith("_headers")) continue;
  if (LEGACY.has(file)) continue;
  scanContent(file, await readText(file), { firstParty: !isVendor(file) && !isLicense(file) });
}
for (const file of ["src/index.js"]) {
  const text = await readFile(file, "utf8").catch(() => null);
  if (text !== null) scanContent(file, text, { firstParty: true });
}

for (const file of files) {
  if (reachable.has(file) || isLicense(file)) continue;
  if (LEGACY.has(file)) report.warn(file, null, "Unreferenced file is still publicly served. Delete it, then remove it from LEGACY_UNREFERENCED in scripts/site.config.mjs.");
  else report.error(file, null, "No page uses this file, but it would be publicly served. Delete it, or reference it from a page.");
}
for (const file of LEGACY) {
  if (!fileSet.has(file)) report.warn("scripts/site.config.mjs", null, `${file} no longer exists; remove it from LEGACY_UNREFERENCED.`);
  else if (reachable.has(file)) report.warn("scripts/site.config.mjs", null, `${file} is now referenced; remove it from LEGACY_UNREFERENCED so it is linted.`);
}

await checkLimits(reachable);

console.log(`Checked ${files.length} deployable files, ${pages.size} pages, ${reachable.size} reachable files and ${externalLinks.size} external links.`);
report.finish();
