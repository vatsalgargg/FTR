// Security and behaviour regression tests for the Cloudflare Worker (src/index.js).
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../src/index.js";
import { ALLOWED_EMAILS, ALLOWED_PHONES } from "../scripts/site.config.mjs";
import { SECURITY_HEADER_NAMES, readHeadersFile } from "../scripts/lib/headers.mjs";

const ORIGIN = "https://ftrgroup.in";
const DIST = new URL("../dist/", import.meta.url);
const TYPES = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", txt: "text/plain; charset=utf-8" };

// Serves dist/ the way the Workers static-assets binding does.
function createAssets({ fail = false } = {}) {
  const assets = {
    calls: 0,
    async fetch(request) {
      assets.calls++;
      if (fail) throw new Error("disk failure at /internal/secret/path");
      const { pathname } = new URL(request.url);
      const file = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
      try {
        const body = await readFile(new URL(`.${file}`, DIST));
        return new Response(body, { status: 200, headers: { "Content-Type": TYPES[file.split(".").pop()] ?? "application/octet-stream" } });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    },
  };
  return assets;
}

const call = (path, init = {}, env = { ASSETS: createAssets() }) => worker.fetch(new Request(new URL(path, ORIGIN), init), env);

let logs;
let originalLog;
beforeEach(() => {
  logs = [];
  originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));
});
afterEach(() => { console.log = originalLog; });

function parseCsp(value) {
  return new Map(value.split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const [name, ...sources] = part.split(/\s+/);
    return [name, sources];
  }));
}

function assertSecurityBaseline(response, label) {
  for (const name of SECURITY_HEADER_NAMES) assert.ok(response.headers.get(name), `${label}: missing ${name}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", label);
  assert.equal(response.headers.get("x-frame-options"), "DENY", label);
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin", label);
  assert.match(response.headers.get("referrer-policy"), /^(no-referrer|same-origin|strict-origin|strict-origin-when-cross-origin)$/, label);
  const hsts = response.headers.get("strict-transport-security");
  assert.ok(Number(/max-age=(\d+)/.exec(hsts)?.[1]) >= 31536000, `${label}: HSTS max-age must be at least one year`);
  assert.match(hsts, /includeSubDomains/, label);
  for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
    assert.match(response.headers.get("permissions-policy"), new RegExp(`${feature}=\\(\\)`), `${label}: ${feature} must be disabled`);
  }
}

describe("security headers", () => {
  test("every kind of response carries the security baseline", async () => {
    const cases = [
      ["/", {}],
      ["/privacy.html", {}],
      ["/studio.css", {}],
      ["/does-not-exist", {}],
      ["/", { method: "POST" }],
      ["/", { headers: { Accept: "text/markdown" } }],
    ];
    for (const [path, init] of cases) assertSecurityBaseline(await call(path, init), `${init.method ?? "GET"} ${path}`);
    assertSecurityBaseline(await call("/", {}, { ASSETS: createAssets({ fail: true }) }), "asset failure");
  });

  test("the CSP allows no inline code, eval, wildcards or third-party origins", async () => {
    const csp = parseCsp((await call("/")).headers.get("content-security-policy"));
    for (const directive of ["default-src", "script-src", "style-src", "object-src", "base-uri", "form-action", "frame-ancestors"]) {
      assert.ok(csp.has(directive), `CSP must set ${directive}`);
    }
    assert.deepEqual(csp.get("object-src"), ["'none'"]);
    assert.ok(["'none'", "'self'"].includes(csp.get("frame-ancestors")[0]), "frame-ancestors must block framing");
    assert.ok(["'none'", "'self'"].includes(csp.get("base-uri")[0]), "base-uri must be restricted");
    for (const [directive, sources] of csp) {
      for (const source of sources) {
        assert.ok(!["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "'wasm-unsafe-eval'", "*", "http:", "https:"].includes(source), `${directive} must not allow ${source}`);
        assert.ok(!/^(https?:)?\/\/|\*\./.test(source), `${directive} must not allow the third-party origin ${source}`);
        if (["script-src", "default-src"].includes(directive)) assert.notEqual(source, "data:", `${directive} must not allow data: URLs`);
      }
    }
  });

  test("dist/_headers applies the same policy as the Worker", async () => {
    const rules = await readHeadersFile();
    const all = rules.get("/*");
    assert.ok(all, "dist/_headers needs a /* rule");
    const response = await call("/");
    for (const name of SECURITY_HEADER_NAMES) {
      assert.equal(all.get(name), response.headers.get(name), `${name} differs between src/index.js and dist/_headers`);
    }
  });
});

describe("request handling", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    test(`rejects ${method} without touching assets`, async () => {
      const assets = createAssets();
      const response = await call("/", { method }, { ASSETS: assets });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "GET, HEAD");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(assets.calls, 0);
    });
  }

  test("redirects HTTP to HTTPS and keeps the path and query", async () => {
    const response = await worker.fetch(new Request("http://ftrgroup.in/privacy.html?ref=a"), { ASSETS: createAssets() });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://ftrgroup.in/privacy.html?ref=a");
  });

  test("does not redirect local development hosts", async () => {
    for (const host of ["localhost", "127.0.0.1"]) {
      const response = await worker.fetch(new Request(`http://${host}:8787/`), { ASSETS: createAssets() });
      assert.equal(response.status, 200, host);
    }
  });

  test("serves the homepage HTML with discovery links", async () => {
    const response = await call("/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(response.headers.get("vary"), /Accept/);
    assert.match(response.headers.get("link"), /<\/llms\.txt>; rel="describedby"/);
    for (const rel of ["api-catalog", "service-desc", "service-doc"]) assert.doesNotMatch(response.headers.get("link"), new RegExp(`rel="${rel}"`), `the site has no API, so it must not advertise ${rel}`);
    assert.match(await response.text(), /<h1[\s>]/);
  });

  test("serves Markdown to agents that ask for it", async () => {
    const response = await call("/", { headers: { Accept: "text/markdown, text/html;q=0.5" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.match(response.headers.get("vary"), /Accept/);
    assert.ok(Number(response.headers.get("x-markdown-tokens")) > 0);
    const body = await response.text();
    assert.match(body, /^---\ntitle: /);
    assert.match(body, /^# FTR/m);
  });

  test("HEAD requests for Markdown have no body", async () => {
    const response = await call("/", { method: "HEAD", headers: { Accept: "text/markdown" } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
  });

  test("unknown paths return the custom 404 page with a 404 status", async () => {
    const response = await call("/no/such/page");
    assert.equal(response.status, 404);
    assert.match(await response.text(), /<title>Page not found/);
  });

  test("asset failures return a generic 500 without internal details", async () => {
    const response = await call("/", {}, { ASSETS: createAssets({ fail: true }) });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.text();
    assert.equal(body, "Internal Server Error");
    assert.ok(!logs.join("\n").includes("/internal/secret/path"), "error messages must not reach the logs");
  });
});

describe("logging privacy", () => {
  test("security logs never record queries, cookies, credentials or IP addresses", async () => {
    const secrets = ["q-secret-123", "cookie-secret-456", "Bearer auth-secret-789", "203.0.113.77"];
    await call(`/?token=${secrets[0]}`, {
      method: "POST",
      headers: { Cookie: `session=${secrets[1]}`, Authorization: secrets[2], "CF-Connecting-IP": secrets[3], "X-Forwarded-For": secrets[3] },
    });
    await call(`/missing?token=${secrets[0]}`, { headers: { Cookie: `session=${secrets[1]}` } });
    assert.ok(logs.length >= 2, "blocked methods and 404s must be logged");
    const output = logs.join("\n");
    for (const secret of secrets) assert.ok(!output.includes(secret), `log leaked ${secret}`);
    for (const line of logs) {
      const entry = JSON.parse(line);
      assert.deepEqual(Object.keys(entry).filter(key => !["type", "method", "path", "country", "rayId", "status", "message"].includes(key)), []);
    }
  });
});

describe("content parity", () => {
  test("the Markdown view publishes the same contact details as the HTML page", async () => {
    const markdown = await (await call("/", { headers: { Accept: "text/markdown" } })).text();
    const html = await readFile(new URL("index.html", DIST), "utf8");
    const digits = text => text.replace(/[^\d]/g, "");
    for (const email of ALLOWED_EMAILS) {
      assert.ok(markdown.includes(email), `Markdown is missing ${email}`);
      assert.ok(html.includes(email), `index.html is missing ${email}`);
    }
    for (const phone of ALLOWED_PHONES) {
      assert.ok(digits(markdown).includes(digits(phone)), `Markdown is missing ${phone}`);
      assert.ok(digits(html).includes(digits(phone)), `index.html is missing ${phone}`);
    }
  });
});
