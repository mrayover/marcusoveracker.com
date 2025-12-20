import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const root = process.cwd();
const entriesDir = path.join(root, "src/currents/entries");
const currentsHtmlPath = path.join(root, "currents.html");

const parseFrontmatter = (md) => {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: {}, body: md };

  const raw = match[1];
  const body = md.slice(match[0].length);

  const data = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    if (val === "null") {
      data[key] = null;
      continue;
    }

    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(",").map(s => s.trim().replace(/^"(.*)"$/, "$1"))
        : [];
      continue;
    }

    data[key] = val.replace(/^"(.*)"$/, "$1");
  }

  return { data, body };
};

const renderEntry = (data, body, file) => {
  const parts = [];
// Date: frontmatter date OR derived from filename prefix YYYY-MM-DD__
const derived = typeof file === "string" ? file.slice(0, 10) : "";
const dateText = (data.date && String(data.date).trim())
  ? String(data.date).trim()
  : derived;

if (dateText) {
  parts.push(`<div class="currents-date">${dateText}</div>`);
}

// Title (optional but recommended)
if (data.title && String(data.title).trim()) {
  parts.push(`<div class="currents-title">${String(data.title).trim()}</div>`);
}



  const links = [data.url_1, data.url_2, data.url_3].filter(
    (u) => typeof u === "string" && u.trim().length > 0
    
  );

  if (data.audio_top && String(data.audio_top).trim()) {
    parts.push(`<audio controls src="${String(data.audio_top).trim()}"></audio>`);
  }

  if (data.image_top && String(data.image_top).trim()) {
    parts.push(
      `<img src="${String(data.image_top).trim()}" alt="${data.image_alt || ""}">`
    );

  }

  // URLs block (only if present)
if (data.url_1) {
  parts.push(
    `<div class="currents-links currents-links-top">
      <a href="${data.url_1}" target="_blank" rel="noopener noreferrer">
        ${data.url_1}
      </a>
    </div>`
  );
}


  // Body markdown
  parts.push(marked.parse(body || ""));
if (data.url_2) {
  parts.push(
    `<div class="currents-links currents-links-bottom">
      <a href="${data.url_2}" target="_blank" rel="noopener noreferrer">
        ${data.url_2}
      </a>
    </div>`
  );
}

  if (data.image_bottom && String(data.image_bottom).trim()) {
    parts.push(
      `<img src="${String(data.image_bottom).trim()}" alt="${data.image_alt || ""}">`
    );
  }

  if (data.audio_bottom && String(data.audio_bottom).trim()) {
    parts.push(`<audio controls src="${String(data.audio_bottom).trim()}"></audio>`);
  }
        parts.push(`<hr class="currents-seperator">`);
  return `
<article class="currents-entry">
  ${parts.join("\n")}
</article>
`;
};


async function build() {
  const files = (await fs.readdir(entriesDir))
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse(); // newest first

  const rendered = [];

  for (const file of files) {
    const raw = await fs.readFile(path.join(entriesDir, file), "utf8");
    const { data, body } = parseFrontmatter(raw);

    if ((data.status || "active") !== "active") continue;


    rendered.push(renderEntry(data, body, file));


  }

  const html = await fs.readFile(currentsHtmlPath, "utf8");

const start = "<!-- CURRENTS:START -->";
const end = "<!-- CURRENTS:END -->";

const startIdx = html.indexOf(start);
const endIdx = html.indexOf(end);

if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  throw new Error("Currents markers not found or out of order.");
}

const before = html.slice(0, startIdx + start.length);
const after = html.slice(endIdx);

const entriesHtml = `
<div class="currents-entries">
${rendered.join("\n")}
</div>
`.trim();

const out = `${before}\n${entriesHtml}\n${after}`;




  await fs.writeFile(currentsHtmlPath, out, "utf8");
}

build();
