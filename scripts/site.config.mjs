// Single source of truth for the CI quality and security checks.
// cspell:ignore NGRAM

export const SITE_ORIGIN = "https://ftrgroup.in";
export const PUBLIC_DIR = "dist";

// Publicly served files that no page references. Lint skips them and check-site warns about them.
// Delete them (or reference them from a page), then remove them from this list.
export const LEGACY_UNREFERENCED = [
  "dist/app.js",
  "dist/network.js",
  "dist/sections.js",
  "dist/template.js",
  "dist/sections.css",
  "dist/styles.css",
  "dist/template.css",
  "dist/assets/gsap.min.js",
  "dist/assets/ScrollTrigger.min.js",
  "dist/assets/cameras.webp",
  "dist/assets/hero-network-v2.png",
  "dist/assets/laptop.webp",
  "dist/assets/obsidian.webp",
  "dist/assets/technology.webp",
  "dist/assets/og-image.svg",
  "dist/assets/ftr-social-preview-v2.svg",
];

// Files that need no inbound reference: crawler, agent and platform conventions.
export const CONVENTIONAL_FILES = [
  "dist/_headers",
  "dist/.assetsignore",
  "dist/404.html",
  "dist/favicon.ico",
  "dist/robots.txt",
  "dist/sitemap.xml",
  "dist/llms.txt",
  "dist/.well-known/api-catalog",
  "dist/.well-known/api-catalog.json",
];

// Used to warn when "© YEAR" or "N years of service" claims go out of date.
export const FOUNDED_YEAR = 2010;

// The only contact details allowed in public files. Anything else is a typo or a personal-data leak.
export const ALLOWED_EMAILS = ["laxman@ftresolver.com"];
export const ALLOWED_PHONES = ["+919555076755", "+911244799155"];

// LanguageTool settings for scripts/check-grammar.mjs. Words in .cspell/project-words.txt are accepted
// by its spelling rule too. Every disabled rule or ignored match needs a reason.
export const GRAMMAR = {
  language: "en-GB",
  level: "picky",
  // House style is British -ise spelling (organisation, authorised). check-grammar enforces it,
  // because LanguageTool accepts both -ise and Oxford -ize in en-GB.
  houseSpelling: "ise",
  disabledRules: {
    OXFORD_SPELLING_Z_NOT_S: "House style is -ise spelling; the houseSpelling check enforces it instead.",
    SERIAL_COMMA_ON: "House style omits the serial comma, as is usual in British English.",
    PUNCTUATION_PARAGRAPH_END: "Headings, labels and button text are checked as separate blocks and need no full stop.",
    ENGLISH_WORD_REPEAT_BEGINNING_RULE: "Blocks from different parts of a page are checked together, so sentences that are far apart look adjacent.",
  },
  // Categories reported as warnings instead of errors: subjective style advice, not mistakes.
  warnCategories: ["STYLE", "REDUNDANCY", "PLAIN_ENGLISH"],
  // Accepted matches: { rule: "RULE_ID", text: "exact flagged text", reason: "why it is correct here" }.
  ignore: [
    { rule: "EN_UPPER_CASE_NGRAM", text: "Conditions", reason: "\"Terms and Conditions\" is the title of the document." },
    { rule: "EN_COMPOUNDS_MULTI_VENDOR", text: "multi-vendor", reason: "The hyphenated form is standard in British English." },
  ],
};

// Cloudflare Workers static assets: 25 MiB per file, 20,000 files per version.
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_ASSET_COUNT = 20000;
export const WARN_IMAGE_BYTES = 1024 * 1024;
