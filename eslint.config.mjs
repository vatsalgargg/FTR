import js from "@eslint/js";
import globals from "globals";
import { LEGACY_UNREFERENCED } from "./scripts/site.config.mjs";

export default [
  {
    // Third-party bundles are checked for known vulnerabilities by retire.js instead.
    ignores: [
      "dist/vendor/**",
      "dist/assets/**/*.min.js",
      "node_modules/**",
      ".wrangler/**",
      "demo-app/**",
      "qa/**",
      "source/**",
      "test-results/**",
      "playwright-report/**",
      ...LEGACY_UNREFERENCED,
    ],
  },
  js.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      // The site CSP has no 'unsafe-eval', so these would break in production.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']",
          message: "Inline style attributes are blocked by the CSP (style-src 'self'). Use element.style or a class.",
        },
        {
          selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
          message: "Avoid innerHTML/outerHTML. Build nodes with createElement/textContent to prevent XSS.",
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML'], CallExpression[callee.object.name='document'][callee.property.name='write']",
          message: "Avoid HTML string injection. Build nodes with createElement/textContent to prevent XSS.",
        },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["dist/**/*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, Lenis: "readonly" } },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: { sourceType: "module", globals: { ...globals.serviceworker } },
    // The Worker's structured security log is its only sink for Cloudflare Logs.
    rules: { "no-console": "off" },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.config.mjs"],
    languageOptions: { sourceType: "module", globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
  {
    // page.evaluate() callbacks in the browser tests run inside the page.
    files: ["tests/e2e/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
