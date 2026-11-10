import { LEGACY_UNREFERENCED } from "./scripts/site.config.mjs";

export default {
  extends: ["stylelint-config-recommended"],
  ignoreFiles: ["dist/vendor/**", "node_modules/**", ...LEGACY_UNREFERENCED.filter(file => file.endsWith(".css"))],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  rules: {
    // The stylesheets layer later overrides on earlier rules on purpose.
    "no-descending-specificity": null,
    "no-duplicate-selectors": null,
    // The CSP only allows same-origin and data: URLs, so anything else would be blocked.
    "function-url-no-scheme-relative": true,
    "function-url-scheme-allowed-list": ["data"],
    "at-rule-disallowed-list": [["import"], { message: "Use a <link> element. @import delays rendering." }],
    "color-no-invalid-hex": true,
  },
};
