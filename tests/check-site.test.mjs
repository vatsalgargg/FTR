// Proves that scripts/check-site.mjs still catches each class of problem, using throwaway fixture sites.
// cspell:ignore AKIA QWERTYUIOPASDF
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL("../scripts/check-site.mjs", import.meta.url));
const GITIGNORE = ".env\n.dev.vars\nnode_modules/\n.wrangler/\n*.zip\n";
const head = (title, extra = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title}</title><meta name="description" content="A fixture page that exists only to prove the site checker works in CI.">${extra}</head>`;

async function checkSite(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ftr-check-site-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(root, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    }
    const env = { ...process.env, SITE_DIR: "dist", GITHUB_ACTIONS: "" };
    try {
      return { code: 0, output: (await run(process.execPath, [SCRIPT], { cwd: root, env })).stdout };
    } catch (error) {
      return { code: error.code, output: error.stdout };
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const cleanSite = {
  ".gitignore": GITIGNORE,
  "dist/index.html": `${head("Fixture home page", '<link rel="canonical" href="https://ftrgroup.in/"><link rel="stylesheet" href="/site.css">')}
<body><h1 id="intro">Home</h1><a href="/about">About</a> <a href="#intro">Top</a>
<a href="mailto:laxman@ftresolver.com">Email</a> <a href="tel:+919555076755">+91&nbsp;95550&nbsp;76755</a></body></html>`,
  "dist/about.html": `${head("Fixture about page", '<link rel="canonical" href="https://ftrgroup.in/about">')}<body><h1>About</h1><a href="/#intro">Home</a></body></html>`,
  "dist/404.html": `${head("Page not found", '<meta name="robots" content="noindex">')}<body><h1>Not found</h1><a href="/">Home</a></body></html>`,
  "dist/site.css": "body{background:url(/grain.svg)}",
  "dist/grain.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
  "dist/robots.txt": "User-agent: *\nAllow: /\nSitemap: https://ftrgroup.in/sitemap.xml\n",
  "dist/sitemap.xml": '<?xml version="1.0"?><urlset><url><loc>https://ftrgroup.in/</loc></url><url><loc>https://ftrgroup.in/about</loc></url></urlset>',
};

test("a clean site passes", async () => {
  const { code, output } = await checkSite(cleanSite);
  assert.equal(code, 0, output);
  assert.match(output, /check-site: 0 error\(s\)/);
});

test("every class of problem is reported", async () => {
  const awsKey = "AKIA" + "Z7QWERTYUIOPASDF";
  const { code, output } = await checkSite({
    ...cleanSite,
    ".gitignore": "node_modules/\n",
    "dist/index.html": `${head("Fixture home page", '<link rel="canonical" href="https://ftrgroup.in/"><script src="https://cdn.example.com/x.js"></script>')}
<body><h1>One</h1><h1>Two</h1>
<script>alert(1)</script><button type="button" onclick="go()">Go</button><p style="color:red">Red</p>
<a href="/missing-page">Missing</a> <a href="#nowhere">Anchor</a> <a href="/about.html">About</a>
<a href="mailto:someone@example.com">Email</a> <a href="tel:+910000000000">Call</a>
<a href="https://example.com" target="_blank">New tab</a><form action="/x"></form>
<p>Key ${awsKey} and http://localhost:3000/api</p><script src="/app.js"></script></body></html>`,
    "dist/app.js": "fetch('/api');",
    "dist/old.png": "png",
    "dist/.env": "SECRET=1",
    "dist/robots.txt": "User-agent: *\nDisallow: /\nSitemap: https://ftrgroup.in/sitemap.xml\n",
    "dist/sitemap.xml": '<?xml version="1.0"?><urlset><url><loc>https://ftrgroup.in/gone</loc></url></urlset>',
  });
  assert.equal(code, 1);
  const expected = [
    "Inline <script> is blocked",
    'Inline event handler "onclick"',
    "Inline style attribute",
    "from another origin",
    "Broken reference",
    "Broken anchor",
    "redirects (307)",
    "is not in ALLOWED_EMAILS",
    "is not in ALLOWED_PHONES",
    'target="_blank" needs rel',
    "<form> is blocked",
    "Possible secret",
    "local development URL",
    "connect-src 'none'",
    "No page uses this file",
    "environment file",
    "blocks every crawler",
    "exactly one",
    "does not map to a page",
    "Indexable page is missing from sitemap.xml",
    ".gitignore must ignore",
  ];
  for (const message of expected) assert.ok(output.includes(message), `expected "${message}" in:\n${output}`);
});
