// Builds a self-contained static preview of the LP into ./preview
// (one HTML fragment + images/videos), for publishing as a shareable page.
// Usage: npm run preview:build
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// With a custom distDir, `output: "export"` writes the static site into that dir.
const outDir = path.join(root, ".next-preview");
const previewDir = path.join(root, "preview");

execSync("npx next build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PREVIEW_EXPORT: "1" },
});

const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");

// Root-relative asset URLs → relative, so the preview works from any folder.
const relativize = (s) => s.replace(/(\s(?:src|href|poster|srcset)=")\/(?!\/)/g, "$1");

// --- CSS: inline it, swap self-hosted next/font faces for Google Fonts ---
const cssHrefs = [...html.matchAll(/<link\b[^>]*>/g)]
  .map((m) => m[0])
  .filter((tag) => /rel="stylesheet"/.test(tag))
  .map((tag) => tag.match(/href="([^"]+)"/)[1]);

const fontName = (raw, fallback) => {
  const name = raw.replace(/_/g, " ");
  if (fallback) return /Mono/.test(raw) ? "monospace" : /Mincho/.test(raw) ? "serif" : "sans-serif";
  return `'${name}'`;
};

let css = cssHrefs
  .map((href) => fs.readFileSync(path.join(outDir, href), "utf8"))
  .join("\n")
  .replace(/@font-face\s*\{[^}]*\}/g, "")
  .replace(/(["'])__(\w+?)(_Fallback)?_[0-9a-f]{4,}\1/g, (_, _q, n, fb) => fontName(n, fb))
  // next/font puts its CSS variables on <html class="__variable_…">; the preview has no such class.
  .replace(/\.__variable_[0-9a-f]+/g, ":root");

// --- Body: drop scripts (the page works without JS), keep markup ---
let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
body = body
  .replace(/<script\b[\s\S]*?<\/script>/g, "")
  .replace(/<link\b[^>]*>/g, "")
  // React sets `muted` as a property only; static autoplay needs the attribute.
  .replace(/<video\b(?![^>]*\bmuted\b)/g, "<video muted");
body = relativize(body);

const title = (html.match(/<title>([^<]*)<\/title>/) || [, "KAMITO"])[1];
// Keep in sync with the next/font families in app/layout.tsx.
const fonts =
  "https://fonts.googleapis.com/css2?family=Jost:wght@300;400" +
  "&family=Shippori+Mincho:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap";

fs.rmSync(previewDir, { recursive: true, force: true });
fs.mkdirSync(previewDir, { recursive: true });
fs.writeFileSync(
  path.join(previewDir, "index.html"),
  `<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
${body}
`,
);

// Copy only the media the page references.
const used = new Set(
  [...body.matchAll(/(?:src|poster)="((?:images|videos)\/[^"]+)"/g)].map((m) => m[1]),
);
for (const rel of used) {
  fs.mkdirSync(path.dirname(path.join(previewDir, rel)), { recursive: true });
  fs.copyFileSync(path.join(root, "public", rel), path.join(previewDir, rel));
}
fs.writeFileSync(path.join(previewDir, "files.json"), JSON.stringify([...used].sort(), null, 2));
console.log(`preview/index.html + ${used.size} media files`);
