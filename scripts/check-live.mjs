// Read-only smoke test of the deployed site: HTTPS, headers, methods, pages, assets, crawler files and TLS.
// Usage: node scripts/check-live.mjs [--expect-current]   (BASE_URL defaults to SITE_ORIGIN)
// --expect-current fails when production does not serve the files in this checkout (use it right after a deploy).
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import tls from "node:tls";
import path from "node:path";
import { parse } from "parse5";
import worker from "../src/index.js";
import { SITE_ORIGIN, PUBLIC_DIR } from "./site.config.mjs";
import { SECURITY_HEADER_NAMES, readHeadersFile } from "./lib/headers.mjs";
import { createReporter } from "./lib/report.mjs";

const report = createReporter("check-live");
const BASE = new URL((process.env.BASE_URL || SITE_ORIGIN).replace(/\/$/, ""));
const expectCurrent = process.argv.includes("--expect-current");
const MISSING = "/ci-check-this-page-does-not-exist";
const MIN_HSTS = 15552000; // Six months: the HSTS preload minimum. Cloudflare's edge setting can replace the Worker's value.
// Same-origin paths that Cloudflare features add at the edge; they are not in the repository.
const EDGE_PATHS = /^\/(cdn-cgi|\.webmcp)\//;

const get = (pathname, init = {}) => fetch(new URL(pathname, BASE), {
  redirect: "manual",
  ...init,
  headers: { "User-Agent": "FTR-CI-live-check (+https://github.com/vatsalgargg/FTR)", ...init.headers },
});
// Line endings are ignored: Windows checkouts convert LF to CRLF, but the deployed bytes are otherwise the same.
const sha = text => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const stripScripts = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/\s+/g, " ");

async function checkHeaders() {
  const response = await get("/");
  if (response.status !== 200) return report.error(null, null, `GET / returned ${response.status}; expected 200.`);
  const expected = (await readHeadersFile()).get("/*");
  for (const name of SECURITY_HEADER_NAMES) {
    const value = response.headers.get(name);
    if (!value) report.error(null, null, `Production response is missing the ${name} header.`);
    else if (name === "strict-transport-security") {
      const maxAge = Number(/max-age=(\d+)/.exec(value)?.[1] ?? 0);
      if (maxAge < MIN_HSTS || !/includeSubDomains/i.test(value)) report.error(null, null, `Weak HSTS header: "${value}".`);
    } else if (value !== expected.get(name)) {
      report.error(null, null, `${name} in production is "${value}", but dist/_headers sets "${expected.get(name)}".`);
    }
  }
}

async function checkBehaviour() {
  const insecure = new URL("/privacy?ci=1", BASE);
  insecure.protocol = "http:";
  const redirect = await fetch(insecure, { redirect: "manual" });
  const location = redirect.headers.get("location");
  if (![301, 308].includes(redirect.status) || location !== new URL("/privacy?ci=1", BASE).href) {
    report.error(null, null, `HTTP is not permanently redirected to HTTPS (status ${redirect.status}, location ${location}).`);
  }
  const post = await get("/", { method: "POST", body: "ci" });
  if (post.status !== 405) report.error(null, null, `POST / returned ${post.status}; the Worker must reject writes with 405.`);
  const markdown = await get("/", { headers: { Accept: "text/markdown" } });
  if (!/^text\/markdown/.test(markdown.headers.get("content-type") ?? "")) report.error(null, null, "Markdown content negotiation is not working.");
  const missing = await get(MISSING);
  if (missing.status !== 404 || !/Page not found/.test(await missing.text())) report.error(null, null, `Unknown pages return ${missing.status} without the custom 404 page.`);
  for (const [pathname, type] of [["/robots.txt", "text/plain"], ["/sitemap.xml", "xml"], ["/llms.txt", "text/plain"]]) {
    const response = await get(pathname);
    if (response.status !== 200 || !(response.headers.get("content-type") ?? "").includes(type)) {
      report.error(null, null, `${pathname} returned ${response.status} ${response.headers.get("content-type")}; expected 200 ${type}.`);
    }
  }
}

async function checkPagesAndAssets() {
  const sitemap = await (await get("/sitemap.xml")).text();
  const pages = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => new URL(new URL(match[1]).pathname, BASE));
  const assets = new Set();
  for (const url of pages) {
    const response = await get(url.pathname);
    if (response.status !== 200) { report.error(null, null, `Sitemap page ${url.pathname} returned ${response.status}${response.headers.get("location") ? ` -> ${response.headers.get("location")}` : ""}.`); continue; }
    const walk = node => {
      for (const name of ["src", "href", "poster"]) {
        const value = node.attrs?.find(a => a.name === name)?.value;
        if (!value || node.tagName === "a" || /^(mailto|tel|data):|^#/.test(value)) continue;
        const target = new URL(value, url);
        if (target.origin === BASE.origin && !EDGE_PATHS.test(target.pathname)) assets.add(target.pathname);
      }
      (node.childNodes ?? []).forEach(walk);
    };
    walk(parse(await response.text()));
  }
  for (const pathname of assets) {
    const response = await get(pathname, { method: "HEAD" });
    if (response.status !== 200) report.error(null, null, `Asset ${pathname} returned ${response.status} in production.`);
  }
  console.log(`Checked ${pages.length} pages and ${assets.size} assets.`);
}

async function checkCertificate() {
  if (BASE.protocol !== "https:") return;
  const cert = await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: BASE.hostname, port: 443, servername: BASE.hostname }, () => { resolve(socket.getPeerCertificate()); socket.end(); });
    socket.on("error", reject);
  });
  const days = Math.floor((new Date(cert.valid_to) - Date.now()) / 86400000);
  if (days < 7) report.error(null, null, `TLS certificate expires in ${days} days (${cert.valid_to}).`);
  else if (days < 21) report.warn(null, null, `TLS certificate expires in ${days} days (${cert.valid_to}).`);
  else console.log(`TLS certificate is valid for ${days} more days.`);
}

// Compares production with this checkout: text assets byte for byte, pages without edge-injected scripts,
// and the Worker's Markdown view. Retries because a new deploy can take a short time to reach every location.
async function checkCurrent() {
  const local = (await readdir(PUBLIC_DIR, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile() && /\.(html|css|js|txt|xml|json)$/.test(entry.name))
    .map(entry => path.join(entry.parentPath, entry.name).split(path.sep).join("/").slice(PUBLIC_DIR.length));
  const markdownRequest = new Request(new URL("/", SITE_ORIGIN), { headers: { Accept: "text/markdown" } });
  const expectedMarkdown = await (await worker.fetch(markdownRequest, {})).text();
  let stale = [];
  for (let attempt = 1; attempt <= (expectCurrent ? 6 : 1); attempt++) {
    stale = [];
    for (const file of local) {
      const pathname = file.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
      if (pathname === "/404") continue;
      const response = await get(pathname);
      const body = await response.text();
      const expected = await readFile(`${PUBLIC_DIR}${file}`, "utf8");
      const same = file.endsWith(".html") ? sha(stripScripts(body)) === sha(stripScripts(expected)) : sha(body) === sha(expected);
      if (response.status !== 200 || !same) stale.push(pathname);
    }
    const markdown = await (await get("/", { headers: { Accept: "text/markdown" } })).text();
    if (markdown !== expectedMarkdown) stale.push("/ (Markdown view from src/index.js)");
    if (!stale.length || attempt === 6) break;
    await new Promise(resolve => setTimeout(resolve, 20000));
  }
  for (const pathname of stale) {
    const message = `Production does not serve the version of ${pathname} in this checkout.`;
    if (expectCurrent) report.error(null, null, message);
    else report.warn(null, null, `${message} Deploy main if this change is meant to be live.`);
  }
}

console.log(`Checking ${BASE.origin}`);
for (const step of [checkHeaders, checkBehaviour, checkPagesAndAssets, checkCertificate, checkCurrent]) {
  try {
    await step();
  } catch (error) {
    report.error(null, null, `${step.name} could not run: ${error.message}`);
  }
}
report.finish();
