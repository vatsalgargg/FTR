// Reads the Cloudflare dist/_headers file into Map<pathPattern, Map<lowercaseHeaderName, value>>.
import { readFile } from "node:fs/promises";

export const SECURITY_HEADER_NAMES = [
  "content-security-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "x-permitted-cross-domain-policies",
];

export function parseHeadersFile(text) {
  const rules = new Map();
  let current;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) rules.set(line.trim(), (current = new Map()));
    else {
      const colon = line.indexOf(":");
      current.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
    }
  }
  return rules;
}

export async function readHeadersFile(file = new URL("../../dist/_headers", import.meta.url)) {
  return parseHeadersFile(await readFile(file, "utf8"));
}
