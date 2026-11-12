// End-to-end checks in real browsers: nothing broken, nothing blocked by the CSP, accessible and responsive.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const MISSING = "/this-page-does-not-exist";
const PAGES = [
  { path: "/", status: 200, title: /FTR/ },
  { path: "/privacy", status: 200, title: /Privacy Policy/ },
  { path: "/terms", status: 200, title: /Terms/ },
  { path: MISSING, status: 404, title: /Page not found/ },
];

// Records anything that means a visitor sees a broken page: script errors, CSP violations and failed requests.
async function watch(page) {
  const problems = [];
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", event => {
      window.__cspViolations.push(`CSP ${event.effectiveDirective} blocked ${event.blockedURI || "inline code"}`);
    });
  });
  page.on("pageerror", error => problems.push(`Uncaught error: ${error.message}`));
  page.on("console", message => {
    // Failed resources are reported with their URL by the response listener below.
    if (message.type() === "error" && !/Failed to load resource/i.test(message.text())) problems.push(`Console error: ${message.text()}`);
  });
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText ?? "";
    // Browsers cancel media and lazy requests on navigation or source changes; that is not a failure.
    if (!/ABORTED|cancel/i.test(reason)) problems.push(`Request failed: ${request.url()} (${reason})`);
  });
  page.on("response", response => {
    if (response.status() >= 400 && !response.url().endsWith(MISSING)) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return async () => [...problems, ...await page.evaluate(() => window.__cspViolations ?? [])];
}

async function loadAllImages(page) {
  return page.evaluate(async () => {
    const images = [...document.images];
    images.forEach(image => { image.loading = "eager"; });
    await Promise.all(images.map(image => image.complete ? image.decode().catch(() => {}) : new Promise(resolve => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    return images.filter(image => !image.naturalWidth).map(image => image.currentSrc || image.src);
  });
}

for (const { path, status, title } of PAGES) {
  test.describe(`page ${path}`, () => {
    test("loads with no errors, CSP violations, failed requests or broken images", async ({ page }) => {
      const problems = await watch(page);
      const response = await page.goto(path);
      expect(response.status()).toBe(status);
      await expect(page).toHaveTitle(title);
      expect(await loadAllImages(page), "broken images").toEqual([]);
      // Scroll to the end so scroll-triggered scripts and media run too.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(800);
      expect(await problems()).toEqual([]);
    });

    test("fits the viewport with no horizontal scrolling", async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return [...document.querySelectorAll("body *")]
          .filter(element => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return box.width > 0 && style.visibility !== "hidden" && style.position !== "fixed" && (box.right > width + 1 || box.left < -1) &&
              !element.closest("[aria-hidden='true'], .logo-strip, .cta-track, .orbit-loader");
          })
          .slice(0, 5)
          .map(element => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")} (${Math.round(element.getBoundingClientRect().right)}px > ${width}px)`);
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "page scrolls sideways").toBeLessThanOrEqual(1);
      expect(overflow, "elements outside the viewport").toEqual([]);
    });

    test.describe("accessibility", () => {
      test.use({ reducedMotion: "reduce" });
      test("has no WCAG 2.1 A/AA violations in dark and light themes", async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "axe results are browser-independent; Chromium is enough.");
        await page.goto(path);
        for (const theme of ["dark", "light"]) {
          if (theme === "light") await page.locator(".theme-toggle").first().click();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          const summary = violations.map(v => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`);
          expect(summary, `${theme} theme`).toEqual([]);
        }
      });
    });
  });
}

test.describe("homepage interactions", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("skip link is the first focus stop and targets the main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "Phones have no Tab key.");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await expect(page.locator(".skip-link")).toHaveAttribute("href", "#main");
  });

  test("mobile menu opens, closes with Escape and returns focus", async ({ page }) => {
    const toggle = page.locator(".n-menu");
    test.skip(!(await toggle.isVisible()), "The menu button only shows on narrow screens.");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#n-navigation")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#n-navigation")).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("mobile menu closes when the user taps outside it and reopens", async ({ page }) => {
    const toggle = page.locator(".n-menu");
    const menu = page.locator("#n-navigation");
    test.skip(!(await toggle.isVisible()), "The menu button only shows on narrow screens.");
    await toggle.click();
    await expect(menu).toHaveClass(/is-open/);
    // Taps inside the panel, away from its links, leave it open.
    const box = await menu.boundingBox();
    await page.mouse.click(box.x + box.width - 4, box.y + 4);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // The 16px gutter beside the panel is plain page content.
    await page.mouse.click(box.x / 2, box.y + box.height + 24);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
    await toggle.click();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("opacity", "1");
  });

  test("service accordion opens one panel at a time", async ({ page }) => {
    await page.locator("#service-tab-1").click();
    await expect(page.locator("#service-tab-1")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#service-tab-0")).toHaveAttribute("aria-expanded", "false");
  });

  test("enquiry topics update the email subject", async ({ page }) => {
    const topic = page.locator(".enquiry-topics button", { hasText: "Systems integration" });
    await topic.click();
    await expect(topic).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("a.enquiry")).toHaveAttribute("href", "mailto:laxman@ftresolver.com?subject=Systems%20integration");
  });

  test("theme and motion toggles work", async ({ page }) => {
    const theme = page.locator(".theme-toggle");
    await theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(theme).toHaveAttribute("aria-pressed", "true");
    await theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const motion = page.locator("#motion-toggle");
    const before = await motion.getAttribute("aria-pressed");
    await motion.click();
    await expect(motion).not.toHaveAttribute("aria-pressed", before);
  });

  test("footer links reach the legal pages", async ({ page }) => {
    for (const [name, url] of [["Privacy Policy", /\/privacy$/], ["Terms", /\/terms$/]]) {
      await page.goto("/");
      await page.locator("footer").getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

test.describe("Worker behaviour in the Workers runtime", () => {
  test("sends security headers on every response", async ({ request }) => {
    for (const path of ["/", "/studio.css", "/assets/favicon-v3.svg", MISSING]) {
      const headers = (await request.get(path)).headers();
      expect(headers["content-security-policy"], path).toContain("default-src 'self'");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["strict-transport-security"], path).toContain("max-age=");
    }
  });

  test("rejects writes, negotiates Markdown and serves the 404 page", async ({ request }) => {
    const post = await request.post("/", { data: "x" });
    expect(post.status()).toBe(405);
    expect(post.headers()["allow"]).toBe("GET, HEAD");
    const markdown = await request.get("/", { headers: { Accept: "text/markdown" } });
    expect(markdown.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
    expect(await markdown.text()).toContain("# FTR");
    const missing = await request.get(MISSING);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("Page not found");
  });
});
