// Grammar, punctuation and wording check for everything visitors and agents read, using LanguageTool.
// Set LANGUAGETOOL_URL to the server (CI starts one on http://localhost:8081).
// cspell:ignore MORFOLOGIK priz seiz capsiz maiz baiz assiz ation ations ational
import { readFile, readdir } from "node:fs/promises";
import { parse } from "parse5";
import { GRAMMAR, LEGACY_UNREFERENCED, PUBLIC_DIR } from "./site.config.mjs";
import { createReporter } from "./lib/report.mjs";

const report = createReporter("check-grammar");
const SERVER = (process.env.LANGUAGETOOL_URL || "http://localhost:8081").replace(/\/$/, "");
const MAX_CHUNK = 15000;

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "body", "button", "caption", "dd", "details", "div", "dl", "dt", "figcaption",
  "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "label", "li", "main", "nav", "ol", "option", "p",
  "section", "summary", "table", "td", "th", "title", "tr", "ul",
]);
const SKIP_TAGS = new Set(["script", "style", "svg", "noscript", "template"]);
const TEXT_ATTRS = ["alt", "title", "aria-label", "placeholder"];
const TEXT_META = new Set(["description", "og:title", "og:description", "og:image:alt", "twitter:title", "twitter:description", "twitter:image:alt"]);

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const hasDirectText = node => (node.childNodes ?? []).some(child => child.nodeName === "#text" && child.value.trim());
const clean = text => text.replace(/\s+/g, " ").trim();

// Splits a page into the blocks a reader sees. Inline elements stay in their sentence;
// elements whose parent has no text of its own (nav links, labels, cards) become blocks.
function htmlBlocks(html) {
  const blocks = [];
  let buffer = [];
  let line = null;
  const flush = () => {
    const text = clean(buffer.join(""));
    if (text) blocks.push({ text, line });
    buffer = [];
    line = null;
  };
  const add = (text, at) => { if (text) blocks.push({ text: clean(text), line: at }); };

  (function visit(node, parentHasText) {
    if (node.nodeName === "#text") {
      if (node.value.trim() && line === null) line = node.sourceCodeLocation?.startLine;
      buffer.push(node.value);
      return;
    }
    if (!node.tagName) return (node.childNodes ?? []).forEach(child => visit(child, false));
    const at = node.sourceCodeLocation?.startLine;
    if (node.tagName === "meta") {
      const key = (attr(node, "name") || attr(node, "property") || "").toLowerCase();
      if (TEXT_META.has(key)) add(attr(node, "content"), at);
      return;
    }
    if (node.tagName === "script" && attr(node, "type") === "application/ld+json") {
      try {
        JSON.stringify(JSON.parse(node.childNodes[0]?.value ?? "{}"), (key, value) => {
          if (key === "description" && typeof value === "string") add(value, at);
          return value;
        });
      } catch { /* check-site reports invalid JSON-LD. */ }
      return;
    }
    if (SKIP_TAGS.has(node.tagName) || attr(node, "aria-hidden") === "true" || attr(node, "hidden") != null) return;
    for (const name of TEXT_ATTRS) add(attr(node, name), at);
    if (node.tagName === "br") { buffer.push(" "); return; }
    const block = BLOCK_TAGS.has(node.tagName) || !parentHasText;
    if (block) flush();
    else buffer.push(" ");
    const direct = hasDirectText(node);
    for (const child of node.childNodes ?? []) visit(child, direct);
    if (block) flush();
    else buffer.push(" ");
  })(parse(html, { sourceCodeLocationInfo: true }), false);
  flush();
  return blocks;
}

// Turns Markdown into plain sentences: no front matter, markers, tables, links or URLs.
function markdownBlocks(markdown, firstLine = 1) {
  const blocks = [];
  let inFrontMatter = false;
  markdown.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === "---") {
      inFrontMatter = index === 0;
      return;
    }
    if (inFrontMatter || /^\s*\|?\s*:?-{3,}/.test(raw)) return;
    const cells = raw.includes("|") ? raw.split("|") : [raw];
    for (const cell of cells) {
      const text = clean(cell
        .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/, "")
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/<?https?:\/\/[^\s>)]+>?/g, "")
        .replace(/[*_`]+/g, ""));
      if (text && /[A-Za-z]/.test(text)) blocks.push({ text, line: firstLine + index });
    }
  });
  return blocks;
}

async function sources() {
  const legacy = new Set(LEGACY_UNREFERENCED);
  const list = [];
  for (const name of (await readdir(PUBLIC_DIR)).filter(n => n.endsWith(".html")).sort()) {
    const file = `${PUBLIC_DIR}/${name}`;
    if (!legacy.has(file)) list.push({ file, blocks: htmlBlocks(await readFile(file, "utf8")) });
  }
  const llms = `${PUBLIC_DIR}/llms.txt`;
  list.push({ file: llms, blocks: markdownBlocks(await readFile(llms, "utf8")) });
  const worker = await readFile("src/index.js", "utf8");
  const template = /function buildMarkdown\(\) \{\s*return `([\s\S]*?)`;/.exec(worker);
  if (!template) report.error("src/index.js", null, "Could not find the Markdown template in buildMarkdown().");
  else {
    const firstLine = worker.slice(0, template.index + template[0].indexOf("`") + 1).split("\n").length;
    list.push({ file: "src/index.js", blocks: markdownBlocks(template[1], firstLine) });
  }
  return list;
}

async function check(text) {
  const body = new URLSearchParams({
    text,
    language: GRAMMAR.language,
    level: GRAMMAR.level,
    disabledRules: Object.keys(GRAMMAR.disabledRules).join(","),
  });
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${SERVER}/v2/check`, { method: "POST", body });
    if (response.ok) return (await response.json()).matches;
    if (attempt >= 4 || ![429, 502, 503, 504].includes(response.status)) {
      throw new Error(`LanguageTool returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 15000));
  }
}

// LanguageTool's spelling rule catches US spellings that cspell accepts in HTML (for example "center"),
// so it stays on, and the cspell project dictionary supplies the accepted names and terms.
const projectWords = new Set((await readFile(".cspell/project-words.txt", "utf8"))
  .split(/\r?\n/).map(word => word.trim().toLowerCase()).filter(word => word && !word.startsWith("#")));
const ignored = (rule, text) =>
  (/^MORFOLOGIK_RULE/.test(rule) && text.toLowerCase().split(/[-’']/).some(part => projectWords.has(part))) ||
  GRAMMAR.ignore.some(entry => entry.rule === rule && entry.text === text);
let checkedBlocks = 0;

// Words where -z- is the only correct spelling.
const Z_ONLY = /^(?:re|over|down|up|under|mid|pint|bite|life|full|king|queen|plus)?(?:siz|priz|seiz|capsiz|maiz|baiz|assiz)(?:e|es|ed|ing|er|ers)$/i;

function checkHouseSpelling(file, block) {
  if (GRAMMAR.houseSpelling !== "ise") return;
  for (const match of block.text.matchAll(/\b[A-Za-z]+[iy]z(?:e|es|ed|ing|er|ers|ation|ations|ational)\b/g)) {
    if (Z_ONLY.test(match[0])) continue;
    const british = match[0].replace(/([iy])z(?=[a-z]*$)/i, (all, vowel) => `${vowel}s`);
    report.error(file, block.line, `House style is British -ise spelling: use "${british}", not "${match[0]}". [HOUSE_SPELLING_ISE] in "${block.text.slice(0, 120)}"`);
  }
}

for (const { file, blocks } of await sources()) {
  const unique = [];
  const seen = new Set();
  for (const block of blocks) if (!seen.has(block.text)) { seen.add(block.text); unique.push(block); }
  checkedBlocks += unique.length;
  // --print shows the extracted text without calling LanguageTool.
  if (process.argv.includes("--print")) {
    unique.forEach(block => console.log(`${file}:${block.line}  ${block.text}`));
    continue;
  }
  unique.forEach(block => checkHouseSpelling(file, block));
  const chunks = [[]];
  let size = 0;
  for (const block of unique) {
    if (size + block.text.length > MAX_CHUNK && chunks.at(-1).length) { chunks.push([]); size = 0; }
    chunks.at(-1).push(block);
    size += block.text.length + 2;
  }
  for (const chunk of chunks) {
    let offset = 0;
    const starts = chunk.map(block => { const start = offset; offset += block.text.length + 2; return start; });
    for (const match of await check(chunk.map(block => block.text).join("\n\n"))) {
      const index = starts.findLastIndex(start => start <= match.offset);
      const block = chunk[index];
      const flagged = block.text.substr(match.offset - starts[index], match.length);
      if (ignored(match.rule.id, flagged)) continue;
      const suggestions = match.replacements.slice(0, 3).map(r => `"${r.value}"`).join(", ");
      const message = `"${flagged}": ${match.message}${suggestions ? ` Suggestion: ${suggestions}.` : ""} [${match.rule.id}] in "${block.text.slice(0, 120)}"`;
      if (GRAMMAR.warnCategories.includes(match.rule.category.id)) report.warn(file, block.line, message);
      else report.error(file, block.line, message);
    }
  }
}

console.log(`Checked ${checkedBlocks} text blocks with LanguageTool (${GRAMMAR.language}, ${GRAMMAR.level}).`);
report.finish();
