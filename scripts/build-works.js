import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const root = process.cwd();
const entriesDir = path.join(root, "src/works/entries");
const worksHtmlPath = path.join(root, "works.html");

// Currents uses a minimal frontmatter parser; we mirror the same “YAML-lite” approach,
// supporting: null, quoted strings, and simple arrays ["a","b"] if needed later.
function parseFrontmatter(md) {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: {}, body: md };

  const raw = match[1];
  const body = md.slice(match[0].length);

  const data = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();

    if (val === "null") {
      data[key] = null;
      continue;
    }

    // simple array: ["a","b"]
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1"))
        : [];
      continue;
    }

    data[key] = val.replace(/^"(.*)"$/, "$1");
  }

  return { data, body };
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePublicAssetPath(p) {
  if (!p || typeof p !== "string") return "";
  // prevent weird paths; keep it filename-only
  const base = path.basename(p);
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return "";
  return base;
}

function statusLabel(status) {
  if (status === "in-progress") return "In Progress";
  if (status === "in-revision") return "In Revision";
  return "Completed";
}

function statusOrder(status) {
  // Page order: In Progress → In Revision → Completed
  if (status === "in-progress") return 0;
  if (status === "in-revision") return 1;
  return 2;
}

function compareWorks(a, b) {
  // 1) explicit order asc (if present)
  const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : null;
  const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : null;

  if (ao !== null && bo !== null && ao !== bo) return ao - bo;
  if (ao !== null && bo === null) return -1;
  if (ao === null && bo !== null) return 1;

  // 2) fallback: year desc, then title asc
  const ay = String(a.year || "");
  const by = String(b.year || "");
  if (ay !== by) return by.localeCompare(ay);
  return String(a.title || "").localeCompare(String(b.title || ""));
}


function renderWorkRow(w) {
  const title = escapeHtml(w.title || "");
  const inst = escapeHtml(w.instrumentation || "");
  const year = escapeHtml(w.year || "");
  const duration = escapeHtml(w.duration || "");
  const revised = escapeHtml(w.revised || "");

  const imageFile = normalizePublicAssetPath(w.image);
  const imageAlt = escapeHtml(w.image_alt || "");

  const audioFile = normalizePublicAssetPath(w.audio);
  const audioCaption = escapeHtml(w.audio_caption || "");

  // markdown body to HTML
  const bodyHtml = w.body ? marked.parse(w.body) : "";
  const hasBody = bodyHtml.trim().length > 0;

const notesBlock = hasBody
  ? `
<div class="pt-3 text-sm text-neutral-800 leading-relaxed works-notes text-left">
  ${bodyHtml}
</div>
`.trim()
  : "";
  // For click-to-open image: title becomes a link-like button only if image exists.
  const titleEl = imageFile
    ? `<button type="button" class="works-title-link text-sm underline underline-offset-4 text-neutral-800 hover:text-black transition" data-works-toggle="image">
         ${title}
       </button>`
    : `<span class="text-sm text-neutral-900">${title}</span>`;

  const metaBits = [
    year ? `<span>${year}</span>` : "",
    duration ? `<span>${duration}</span>` : "",
    revised ? `<span class="text-neutral-500">rev. ${revised}</span>` : "",
  ].filter(Boolean);

  const metaLine = metaBits.length
    ? `<div class="text-xs text-neutral-600 mt-1">${metaBits.join(" · ")}</div>`
    : "";

  const imageDrawer = imageFile
    ? `
<div class="works-drawer max-h-0 overflow-hidden transition-[max-height] duration-200 ease-out" data-works-drawer="image">
  <div class="pt-3">
    <img
      src="/img/works/${imageFile}"
      alt="${imageAlt}"
      class="works-cover block w-full max-w-[520px] mx-auto h-auto border border-neutral-200"
      loading="lazy"
    />

  </div>
</div>
`.trim()
    : "";

const audioBlock = audioFile
  ? `
<div class="pt-3 space-y-2">
  <a
    class="text-sm underline underline-offset-4 text-neutral-700 hover:text-black transition"
    href="/mp3/works/${audioFile}"
    target="_blank"
    rel="noopener noreferrer"
  >
    Audio (mp3)
  </a>

  <audio controls preload="none" class="w-full">
    <source src="/mp3/works/${audioFile}" type="audio/mpeg" />
  </audio>

  ${audioCaption ? `<div class="text-xs text-neutral-600">${audioCaption}</div>` : ""}
</div>
`.trim()
  : "";

  return `
<article class="border border-neutral-200 p-4 text-center" data-works-row>
  <div class="tracking-wide">${titleEl}</div>
  <div class="text-sm text-neutral-600 mt-1">${inst}</div>
  ${metaLine}
  ${imageDrawer}
  ${audioBlock}
  ${notesBlock}
</article>
`.trim();
}

async function build() {
  await fs.mkdir(entriesDir, { recursive: true });

  const files = (await fs.readdir(entriesDir))
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();

  const works = [];
  for (const file of files) {
    const full = path.join(entriesDir, file);
    const md = await fs.readFile(full, "utf8");
    const { data, body } = parseFrontmatter(md);

    // Required-ish fields (soft-enforced: skip if missing title)
    if (!data.title) continue;

    works.push({
      id: data.id || file.replace(/\.md$/i, ""),
      title: data.title || "",
      status: data.status || "in-progress",
      order: data.order || "",
      year: data.year || "",
      instrumentation: data.instrumentation || "",
      duration: data.duration || "",
      revised: data.revised || "",
      image: data.image || "",
      image_alt: data.image_alt || "",
      audio: data.audio || "",
      audio_caption: data.audio_caption || "",
      body: body || "",
    });
  }

  // group by status (page order fixed)
  const grouped = new Map();
  for (const w of works) {
    const key = w.status || "in-progress";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(w);
  }

  for (const arr of grouped.values()) arr.sort(compareWorks);

  const statusKeys = Array.from(grouped.keys()).sort((a, b) => statusOrder(a) - statusOrder(b));

  const sectionsHtml = statusKeys
    .map((k) => {
      const label = statusLabel(k);
      const items = grouped.get(k) || [];
      return `
<section class="space-y-3">
  <h3 class="text-xs tracking-widest uppercase text-neutral-500">${escapeHtml(label)}</h3>
  <div class="space-y-4">
    ${items.map(renderWorkRow).join("\n")}
  </div>
</section>
`.trim();
    })
    .join("\n\n");

  // Works page interaction: only one image drawer open at a time, click toggles.
  // (Keeps behavior local to Works; does not touch global nav scripts.)
  const interactionScript = `
<script>
(function () {
  const root = document.querySelector(".works-list");
  if (!root) return;

  function closeAllExcept(exceptRow) {
    root.querySelectorAll("[data-works-row]").forEach((row) => {
      if (row === exceptRow) return;
      const drawer = row.querySelector('[data-works-drawer="image"]');
      if (drawer) drawer.classList.remove("max-h-[800px]");
    });
  }

  root.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-works-toggle="image"]');
    if (!btn) return;

    const row = btn.closest("[data-works-row]");
    if (!row) return;

    const drawer = row.querySelector('[data-works-drawer="image"]');
    if (!drawer) return;

    const isOpen = drawer.classList.contains("max-h-[800px]");
    closeAllExcept(row);
    drawer.classList.toggle("max-h-[800px]", !isOpen);
  });
})();
</script>
`.trim();

const injected = `
<div class="works-list space-y-10 w-full max-w-[920px] mx-auto">
  ${sectionsHtml}
</div>
${interactionScript}
`.trim();


  const html = await fs.readFile(worksHtmlPath, "utf8");
  const start = "<!-- WORKS:START -->";
  const end = "<!-- WORKS:END -->";

  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("Works markers not found or out of order.");
  }

  const before = html.slice(0, startIdx + start.length);
  const after = html.slice(endIdx);

  const out = `${before}\n${injected}\n${after}`;
  await fs.writeFile(worksHtmlPath, out, "utf8");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
