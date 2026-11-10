// UI/UX sweep across real device sizes: layout overflow, tap targets, legible text, image distortion
// and Core Web Vitals budgets. Runs in Chromium only, which can emulate any viewport and reports layout metrics.
import { test, expect } from "@playwright/test";

const PAGES = ["/", "/privacy", "/terms", "/this-page-does-not-exist"];
const SCREENS = [
  { name: "iPhone SE (1st gen)", width: 320, height: 568, mobile: true },
  { name: "Android small", width: 360, height: 800, mobile: true },
  { name: "iPhone SE", width: 375, height: 667, mobile: true },
  { name: "iPhone 15", width: 390, height: 844, mobile: true },
  { name: "Pixel 8", width: 412, height: 915, mobile: true },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, mobile: true },
  { name: "phone landscape", width: 844, height: 390, mobile: true },
  { name: "Android landscape", width: 915, height: 412, mobile: true },
  { name: "iPad portrait", width: 768, height: 1024, mobile: true },
  { name: "iPad Air portrait", width: 820, height: 1180, mobile: true },
  { name: "iPad landscape", width: 1024, height: 768, mobile: true },
  { name: "laptop", width: 1280, height: 800, mobile: false },
  { name: "laptop HD", width: 1366, height: 768, mobile: false },
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "full HD", width: 1920, height: 1080, mobile: false },
  { name: "QHD", width: 2560, height: 1440, mobile: false },
];
// Decorative or intentionally off-canvas parts: marquees, the loader and hidden duplicates.
const IGNORE = "[aria-hidden='true'], .logo-strip, .cta-track, .orbit-loader, [hidden]";
const MIN_TARGET = 24; // WCAG 2.2 AA 2.5.8 Target Size (Minimum)
const LEGIBLE_PX = 12;
const LEGIBLE_SHARE = 0.6; // Lighthouse "font-size" audit: at least 60% of text at 12px or more
const CLS_BUDGET = 0.1;
const LCP_BUDGET_MS = 2500;

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "desktop-chrome", "The sweep runs once, in Chromium.");
});

for (const screen of SCREENS) {
  test.describe(`${screen.name} ${screen.width}x${screen.height}`, () => {
    test.use({
      viewport: { width: screen.width, height: screen.height },
      isMobile: screen.mobile,
      hasTouch: screen.mobile,
      deviceScaleFactor: screen.mobile ? 2 : 1,
    });

    for (const path of PAGES) {
      test(`${path} layout, targets, text and images`, async ({ page }) => {
        await page.goto(path);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);

        const report = await page.evaluate(({ IGNORE, MIN_TARGET, LEGIBLE_PX }) => {
          const width = document.documentElement.clientWidth;
          const visible = element => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0 && !element.closest(IGNORE);
          };
          const label = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].map(c => `.${c}`).join("")}`;

          const overflow = [...document.querySelectorAll("body *")]
            .filter(element => visible(element) && getComputedStyle(element).position !== "fixed")
            .filter(element => { const box = element.getBoundingClientRect(); return box.right > width + 1 || box.left < -1; })
            .map(element => `${label(element)} spans ${Math.round(element.getBoundingClientRect().left)}..${Math.round(element.getBoundingClientRect().right)}px of ${width}px`);

          // Links inside running text are exempt from the target-size rule, as WCAG allows.
          const inline = element => element.tagName === "A" && element.parentElement?.closest("p, li, address, dd, td") &&
            [...element.parentElement.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
          const smallTargets = [...document.querySelectorAll("a[href], button, summary, [role='button'], input, select, textarea")]
            .filter(element => visible(element) && !inline(element))
            .map(element => ({ element, box: element.getBoundingClientRect() }))
            // Under 2px means visually hidden until focused (skip links), not a tiny target.
            .filter(({ box }) => (box.width < MIN_TARGET || box.height < MIN_TARGET) && box.width > 2 && box.height > 2)
            .map(({ element, box }) => `${label(element)} "${element.textContent.trim().slice(0, 30)}" is ${Math.round(box.width)}x${Math.round(box.height)}px`);

          let legible = 0;
          let total = 0;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const parent = node.parentElement;
            const length = node.textContent.trim().length;
            if (!length || !parent || !visible(parent)) continue;
            total += length;
            if (parseFloat(getComputedStyle(parent).fontSize) >= LEGIBLE_PX) legible += length;
          }

          const distorted = [...document.images]
            .filter(image => visible(image) && image.naturalWidth && ["fill", ""].includes(getComputedStyle(image).objectFit))
            .filter(image => {
              const box = image.getBoundingClientRect();
              return Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) / (image.naturalWidth / image.naturalHeight) > 0.03;
            })
            .map(image => `${image.getAttribute("src")} is stretched to ${Math.round(image.getBoundingClientRect().width)}x${Math.round(image.getBoundingClientRect().height)}`);

          return {
            scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            overflow: overflow.slice(0, 8),
            smallTargets: smallTargets.slice(0, 8),
            legibleShare: total ? legible / total : 1,
            distorted,
          };
        }, { IGNORE, MIN_TARGET, LEGIBLE_PX });

        expect(report.scroll, "page scrolls sideways").toBeLessThanOrEqual(1);
        expect(report.overflow, "elements cut off at the screen edge").toEqual([]);
        expect(report.smallTargets, `tap targets smaller than ${MIN_TARGET}x${MIN_TARGET}px`).toEqual([]);
        expect(report.legibleShare, `share of text at ${LEGIBLE_PX}px or larger`).toBeGreaterThanOrEqual(LEGIBLE_SHARE);
        expect(report.distorted, "stretched or squashed images").toEqual([]);
      });
    }

    test("homepage Core Web Vitals stay within budget", async ({ page }) => {
      await page.addInitScript(() => {
        window.__vitals = { cls: 0, lcp: 0 };
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__vitals.cls += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__vitals.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      await page.goto("/");
      await page.waitForLoadState("load");
      await page.waitForTimeout(2500);
      const vitals = await page.evaluate(() => window.__vitals);
      expect(vitals.cls, "Cumulative Layout Shift").toBeLessThan(CLS_BUDGET);
      expect(vitals.lcp, "Largest Contentful Paint (ms, local server)").toBeLessThan(LCP_BUDGET_MS);
    });
  });
}
