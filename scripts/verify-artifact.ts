import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const expectedDescription = "Индивидуальные занятия английским для школьников, студентов и взрослых: понятные тарифы, гибкий формат и обучение в комфортном темпе.";

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Published artifact contains a symlink: ${full}`);
    return entry.isDirectory() ? filesUnder(full) : [full];
  }));
  return nested.flat();
}

const files = await filesUnder(dist);
if (!files.some((file) => file.endsWith("/.nojekyll"))) throw new Error("Missing .nojekyll");
for (const required of [
  "index.html",
  "404.html",
  "liquid-scroll-lab/reference-v7-micro-fidelity/index.html",
  "media/mascot/Liquid_cat_poster_alpha_decontaminated.png",
  "media/v7-application/pro-application-material-master-v1-silent.mp4",
]) {
  if (!files.includes(path.join(dist, required))) throw new Error(`Missing artifact file: ${required}`);
}

const referenceSources = [
  "src/components/LiquidReferenceHeroV7.tsx",
  "src/styles/globals.css",
  "src/styles/liquid-reference-v7.module.css",
];
const referencedPublicAssets = new Set<string>();
for (const source of referenceSources) {
  const contents = await readFile(path.join(root, source), "utf8");
  for (const match of contents.matchAll(/\/(?:media|mascot)\/[^"'`)\s}]+/g)) {
    referencedPublicAssets.add(match[0].replace(/[?#].*$/, ""));
  }
}
for (const reference of referencedPublicAssets) {
  const publishedPath = path.join(dist, reference.slice(1));
  if (!files.includes(publishedPath)) throw new Error(`Referenced public asset is absent: ${reference}`);
}

let totalBytes = 0;
const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt"]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?token|secret[_-]?key|rate[_-]?limit[_-]?salt)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/i,
  /sk-[A-Za-z0-9]{20,}/,
];
const privacyPatterns = [
  /Synthetic Parent/i,
  /Synthetic Learner/i,
  /synthetic@example\.invalid/i,
  /internalNotes/,
  /idempotency_key_hash/,
  /Cf-Access-Jwt-Assertion/i,
];

for (const file of files) {
  const stats = await lstat(file);
  totalBytes += stats.size;
  if (stats.size > 100 * 1024 * 1024) throw new Error(`File exceeds GitHub's 100 MiB file boundary: ${file}`);
  if (!textExtensions.has(path.extname(file))) continue;
  const contents = await readFile(file, "utf8");
  for (const pattern of [...secretPatterns, ...privacyPatterns]) {
    if (pattern.test(contents)) throw new Error(`Forbidden published-artifact pattern ${pattern} in ${file}`);
  }
}
if (totalBytes > 1024 * 1024 * 1024) throw new Error("Published artifact exceeds 1 GiB");

const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");
const fallbackHtml = await readFile(path.join(dist, "404.html"), "utf8");
const legacyHtml = await readFile(path.join(dist, "liquid-scroll-lab/reference-v7-micro-fidelity/index.html"), "utf8");
if (indexHtml !== fallbackHtml || indexHtml !== legacyHtml) throw new Error("Route fallback HTML drifted from index.html");
if ((indexHtml.match(new RegExp(expectedDescription, "g")) ?? []).length !== 3) {
  throw new Error("Standard, Open Graph, and X descriptions are not synchronized");
}
if (!indexHtml.includes("Content-Security-Policy")) throw new Error("Missing static Content Security Policy");
const configuredBase = process.env.GITHUB_PAGES_BASE?.replace(/^\/+|\/+$/g, "") ?? "";
if (configuredBase && (indexHtml.includes('src="/assets/') || indexHtml.includes('href="/assets/'))) {
  throw new Error("Build contains repository-root asset URLs instead of Pages-subpath URLs");
}

console.log(JSON.stringify({
  files: files.length,
  referencedPublicAssets: referencedPublicAssets.size,
  secretAndPrivacyScan: "pass",
  totalBytes,
}));
