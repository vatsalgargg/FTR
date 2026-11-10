import { LEGACY_UNREFERENCED } from "./scripts/site.config.mjs";

export default {
  version: "0.2",
  // Indian English follows British spelling. Code files also accept US spelling (color, center).
  language: "en-GB",
  useGitignore: true,
  dictionaryDefinitions: [{ name: "project-words", path: "./.cspell/project-words.txt", addWords: true }],
  dictionaries: ["project-words", "en-common-misspellings"],
  files: [
    "dist/**/*.{html,txt,xml,json,css,js,svg}",
    "dist/.well-known/*",
    "dist/_headers",
    "src/**/*.js",
    "scripts/**/*.mjs",
    "tests/**/*.mjs",
    "*.md",
    "*.{json,toml,mjs}",
    ".github/**/*.{yml,md}",
  ],
  ignorePaths: ["node_modules/**", "package-lock.json", "dist/vendor/**", "dist/assets/**/*.min.js", ...LEGACY_UNREFERENCED],
  ignoreRegExpList: ["Urls", "Email", "HexValues", "Base64", String.raw`/data:[^"')\s]+/g`, String.raw`/\b[0-9a-f]{32,}\b/gi`],
  overrides: [
    {
      filename: ["**/*.{js,mjs,css,json,toml,yml,svg}", "dist/_headers", "dist/.well-known/*"],
      language: "en,en-GB",
    },
  ],
};
