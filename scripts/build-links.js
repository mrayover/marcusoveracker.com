import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "src/links/links.json");
const linksHtmlPath = path.join(root, "links.html");

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  // allow only http(s)
  if (!/^https?:\/\//i.test(u)) return "";
  return u;
}

function normalizeId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderSection(section) {
  const title = section.title == null ? "" : String(section.title).trim();
  const links = Array.isArray(section.links) ? section.links : [];

  const items = links
    .map((l) => {
      const label = escapeHtml(l.label || "");
      const url = safeUrl(l.url);
      if (!label || !url) return "";
      return `
<li class="links-item">
  <a class="links-a" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>
</li>`.trim();
    })
    .filter(Boolean)
    .join("\n");

  if (!items) return "";

  const header = title
    ? `<h3 class="links-section-title">${escapeHtml(title)}</h3>`
    : "";

  const id = normalizeId(section.id || title || "section");

  return `
<section class="links-section" id="${escapeHtml(id)}">
  ${header}
  <ul class="links-list">
    ${items}
  </ul>
</section>
`.trim();
}

async function build() {
  // ensure file exists
  let raw = "{}";
  try {
    raw = await fs.readFile(dataPath, "utf8");
  } catch {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify({ sections: [] }, null, 2), "utf8");
    raw = await fs.readFile(dataPath, "utf8");
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { sections: [] };
  }

  const sections = Array.isArray(data.sections) ? data.sections : [];
  const rendered = sections.map(renderSection).filter(Boolean).join("\n\n");

  const injected = `
<div class="links-wrap w-full max-w-[920px] mx-auto mt-10 space-y-10 text-left">
  ${rendered || `<div class="text-sm text-neutral-600">No links yet.</div>`}
</div>
`.trim();

  const html = await fs.readFile(linksHtmlPath, "utf8");
  const start = "<!-- LINKS:START -->";
  const end = "<!-- LINKS:END -->";

  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("Links markers not found or out of order.");
  }

  const before = html.slice(0, startIdx + start.length);
  const after = html.slice(endIdx);

  const out = `${before}\n${injected}\n${after}`;
  await fs.writeFile(linksHtmlPath, out, "utf8");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
