import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from "node:path";
import fs from "node:fs/promises";

function currentsDevGui() {
  const GUI_ROUTE = "/__currents";
  const API_BASE = "/__currents/api";

  const root = process.cwd();
  const entriesDir = path.resolve(root, "src/currents/entries");

  const safeBasename = (name) => {
    // allow: letters, numbers, dash, underscore, dot
    const base = path.basename(name || "");
    if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
    return base;
  };

  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "entry";

  const parseFrontmatter = (md) => {
    const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!m) return { data: {}, body: md };
    const fmRaw = m[1];
    const body = md.slice(m[0].length);

    const data = {};
    for (const line of fmRaw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf(":");
      if (idx === -1) continue;

      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();

      // arrays like: tags: []
      if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1).trim();
        if (!inner) data[key] = [];
        else {
          data[key] = inner
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => x.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"));
        }
        continue;
      }

      // null
      if (val === "null") {
        data[key] = null;
        continue;
      }

      // strip quotes
      val = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      data[key] = val;
    }

    return { data, body };
  };

  const serializeFrontmatter = (data) => {
    // enforce your contract + ordering
    const orderedKeys = [
      "id",
      "date",
      "title",
      "status",
      "archive",
      "tags",
      "url_1",
      "url_2",
      "url_3",
      "image_top",
      "image_bottom",
      "image_alt",
      "audio_top",
      "audio_bottom",
      "audio_caption",
    ];

    const esc = (v) => {
      if (v === null) return "null";
      const s = String(v ?? "");
      // quote only when needed
      return /[:\n\r]/.test(s) ? JSON.stringify(s) : `"${s.replace(/"/g, '\\"')}"`;
    };

    const lines = ["---"];
    for (const k of orderedKeys) {
      const v = data[k];

      if (k === "tags") {
        const arr = Array.isArray(v) ? v : [];
        const rendered = arr.map((t) => `"${String(t).replace(/"/g, '\\"')}"`).join(", ");
        lines.push(`tags: [${rendered}]`);
        continue;
      }

      if (k === "archive") {
        lines.push(`archive: ${v === null ? "null" : esc(v)}`);
        continue;
      }

      // default empty string for unspecified string fields
      if (v === undefined) lines.push(`${k}: ""`);
      else if (v === null) lines.push(`${k}: null`);
      else lines.push(`${k}: ${esc(v)}`);
    }
    lines.push("---");
    return lines.join("\n");
  };

  const buildEntryMarkdown = (data, body) => {
    const fm = serializeFrontmatter(data);
    // you want the bracket at the end of each post; keep it in the file
    // exactly as you asked (dash line, not necessarily this length).
    const bracket = "\n\n-----------------------------------------------------------------------------------------\n";
    const cleanBody = String(body || "").replace(/\s+$/, "");
    return `${fm}\n${cleanBody}${bracket}`;
  };

  const readAllEntries = async () => {
    await fs.mkdir(entriesDir, { recursive: true });
    const files = (await fs.readdir(entriesDir)).filter((f) => f.endsWith(".md"));
    const out = [];
    for (const f of files) {
      const full = path.join(entriesDir, f);
      const md = await fs.readFile(full, "utf8");
      const { data } = parseFrontmatter(md);
      out.push({
        file: f,
        id: data.id || f.replace(/\.md$/, ""),
        date: data.date || "",
        title: data.title || f.replace(/\.md$/, ""),
        status: data.status || "active",
      });
    }
    // newest first (lex sort works for YYYY-MM-DD)
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return out;
  };

  const guiHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Currents GUI (Dev Only)</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 14px/1.3 system-ui, sans-serif; margin: 16px; max-width: 1100px; }
    .grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
    .card { border: 1px solid rgba(127,127,127,.35); border-radius: 10px; padding: 12px; }
    h1 { font-size: 16px; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 12px; }
    label { display: block; font-size: 12px; opacity: .85; margin: 10px 0 4px; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid rgba(127,127,127,.35); background: transparent; color: inherit; }
    textarea { min-height: 260px; resize: vertical; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    button { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(127,127,127,.35); background: transparent; color: inherit; cursor: pointer; }
    button:hover { border-color: rgba(127,127,127,.65); }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 8px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
    li:hover { border-color: rgba(127,127,127,.35); }
    li.active { border-color: rgba(127,127,127,.65); }
    .meta { font-size: 12px; opacity: .8; margin-top: 2px; }
    .status { font-size: 12px; opacity: .8; }
    .notice { margin-top: 10px; font-size: 12px; opacity: .85; }
  </style>
</head>
<body>
  <h1>Currents GUI (Dev Only)</h1>
  <div class="grid">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>Entries</strong>
        <button id="refreshBtn" type="button">Refresh</button>
      </div>
      <div class="notice">Files: <code>src/currents/entries/*.md</code></div>
      <ul id="list"></ul>
    </div>

    <div class="card">
      <div class="row">
        <div>
          <label>Date</label>
          <input id="date" type="date" />
        </div>
        <div>
          <label>Status</label>
          <input id="status" type="text" placeholder="active" />
        </div>
      </div>

      <label>Title</label>
      <input id="title" type="text" />

      <label>Tags (comma-separated)</label>
      <input id="tags" type="text" placeholder="reading, listening" />

      <div class="row">
        <div>
          <label>URL 1</label>
          <input id="url_1" type="text" />
        </div>
        <div>
          <label>URL 2</label>
          <input id="url_2" type="text" />
        </div>
      </div>

      <label>URL 3</label>
      <input id="url_3" type="text" />

      <div class="row">
        <div>
          <label>Image (top)</label>
          <input id="image_top" type="text" placeholder="/img/..." />
        </div>
        <div>
          <label>Image (bottom)</label>
          <input id="image_bottom" type="text" placeholder="/img/..." />
        </div>
      </div>

      <label>Image alt</label>
      <input id="image_alt" type="text" />

      <div class="row">
        <div>
          <label>Audio (top) [reserved]</label>
          <input id="audio_top" type="text" placeholder="/audio/...mp3" />
        </div>
        <div>
          <label>Audio (bottom) [reserved]</label>
          <input id="audio_bottom" type="text" placeholder="/audio/...mp3" />
        </div>
      </div>

      <label>Audio caption [reserved]</label>
      <input id="audio_caption" type="text" />

      <label>Body (Markdown)</label>
      <textarea id="body" spellcheck="false"></textarea>

      <div class="btns">
        <button id="newBtn" type="button">New</button>
        <button id="createBtn" type="button">Create file</button>
        <button id="saveBtn" type="button">Save</button>
      </div>

      <div class="notice" id="msg"></div>
    </div>
  </div>

<script>
  const API = "${API_BASE}";
  const els = {
    list: document.getElementById("list"),
    refreshBtn: document.getElementById("refreshBtn"),
    newBtn: document.getElementById("newBtn"),
    createBtn: document.getElementById("createBtn"),
    saveBtn: document.getElementById("saveBtn"),
    msg: document.getElementById("msg"),
    date: document.getElementById("date"),
    title: document.getElementById("title"),
    status: document.getElementById("status"),
    tags: document.getElementById("tags"),
    url_1: document.getElementById("url_1"),
    url_2: document.getElementById("url_2"),
    url_3: document.getElementById("url_3"),
    image_top: document.getElementById("image_top"),
    image_bottom: document.getElementById("image_bottom"),
    image_alt: document.getElementById("image_alt"),
    audio_top: document.getElementById("audio_top"),
    audio_bottom: document.getElementById("audio_bottom"),
    audio_caption: document.getElementById("audio_caption"),
    body: document.getElementById("body"),
  };

  let currentFile = null;
  let currentId = null;

  const setMsg = (t) => { els.msg.textContent = t || ""; };

  const todayStr = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return \`\${d.getFullYear()}-\${pad(d.getMonth()+1)}-\${pad(d.getDate())}\`;
  };

  const blank = () => {
    currentFile = null;
    currentId = null;
    els.date.value = todayStr();
    els.title.value = "";
    els.status.value = "active";
    els.tags.value = "";
    els.url_1.value = "";
    els.url_2.value = "";
    els.url_3.value = "";
    els.image_top.value = "";
    els.image_bottom.value = "";
    els.image_alt.value = "";
    els.audio_top.value = "";
    els.audio_bottom.value = "";
    els.audio_caption.value = "";
    els.body.value = "";
    [...els.list.children].forEach(li => li.classList.remove("active"));
    setMsg("New entry (not saved).");
  };

  const loadList = async () => {
    const r = await fetch(API + "/list");
    const items = await r.json();
    els.list.innerHTML = "";
    for (const it of items) {
      const li = document.createElement("li");
      li.dataset.file = it.file;
      li.innerHTML = \`<div><strong>\${it.title || it.file}</strong></div><div class="meta">\${it.date || ""} · <span class="status">\${it.status || "active"}</span></div>\`;
      li.addEventListener("click", async () => {
        [...els.list.children].forEach(x => x.classList.remove("active"));
        li.classList.add("active");
        const rr = await fetch(API + "/read?file=" + encodeURIComponent(it.file));
        const payload = await rr.json();
        currentFile = payload.file;
        currentId = payload.data.id || payload.file.replace(/\\.md$/, "");
        els.date.value = payload.data.date || "";
        els.title.value = payload.data.title || "";
        els.status.value = payload.data.status || "active";
        els.tags.value = (payload.data.tags || []).join(", ");
        els.url_1.value = payload.data.url_1 || "";
        els.url_2.value = payload.data.url_2 || "";
        els.url_3.value = payload.data.url_3 || "";
        els.image_top.value = payload.data.image_top || "";
        els.image_bottom.value = payload.data.image_bottom || "";
        els.image_alt.value = payload.data.image_alt || "";
        els.audio_top.value = payload.data.audio_top || "";
        els.audio_bottom.value = payload.data.audio_bottom || "";
        els.audio_caption.value = payload.data.audio_caption || "";
        els.body.value = payload.body || "";
        setMsg("Loaded: " + it.file);
      });
      els.list.appendChild(li);
    }
    setMsg("Loaded entries list.");
  };

  const gather = () => {
    const tags = els.tags.value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    return {
      file: currentFile, // null for create
      data: {
        id: currentId,
        date: els.date.value,
        title: els.title.value,
        status: (els.status.value || "active").trim(),
        archive: null,
        tags,
        url_1: els.url_1.value,
        url_2: els.url_2.value,
        url_3: els.url_3.value,
        image_top: els.image_top.value,
        image_bottom: els.image_bottom.value,
        image_alt: els.image_alt.value,
        audio_top: els.audio_top.value,
        audio_bottom: els.audio_bottom.value,
        audio_caption: els.audio_caption.value,
      },
      body: els.body.value,
    };
  };

  els.refreshBtn.addEventListener("click", loadList);
  els.newBtn.addEventListener("click", blank);

  els.createBtn.addEventListener("click", async () => {
    const payload = gather();
    const r = await fetch(API + "/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await r.json();
    if (!r.ok) return setMsg(out.error || "Create failed.");
    currentFile = out.file;
    currentId = out.id;
    setMsg("Created: " + out.file);
    await loadList();
  });

  els.saveBtn.addEventListener("click", async () => {
    if (!currentFile) return setMsg("No file loaded. Use Create file first.");
    const payload = gather();
    const r = await fetch(API + "/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await r.json();
    if (!r.ok) return setMsg(out.error || "Save failed.");
    setMsg("Saved: " + out.file);
    await loadList();
  });

  blank();
  loadList();
</script>
</body>
</html>`;

  return {
    name: "currents-dev-gui",
    apply: "serve", // DEV ONLY
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next();

          // GUI page
          if (req.method === "GET" && req.url === GUI_ROUTE) {
            res.statusCode = 200;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(guiHtml);
            return;
          }

          // API: list
          if (req.method === "GET" && req.url.startsWith(`${API_BASE}/list`)) {
            const items = await readAllEntries();
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify(items));
            return;
          }

          // API: read?file=
          if (req.method === "GET" && req.url.startsWith(`${API_BASE}/read`)) {
            const u = new URL(req.url, "http://localhost");
            const file = safeBasename(u.searchParams.get("file"));
            if (!file) throw new Error("Bad file.");
            const full = path.join(entriesDir, file);
            const md = await fs.readFile(full, "utf8");
            const { data, body } = parseFrontmatter(md);
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ file, data, body }));
            return;
          }

          // helper to read JSON body
          const readJson = async () => {
            const chunks = [];
            for await (const c of req) chunks.push(c);
            const raw = Buffer.concat(chunks).toString("utf8");
            return JSON.parse(raw || "{}");
          };

          // API: create
          if (req.method === "POST" && req.url === `${API_BASE}/create`) {
            const payload = await readJson();
            const date = String(payload?.data?.date || "").trim();
            const title = String(payload?.data?.title || "").trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must be YYYY-MM-DD.");
            if (!title) throw new Error("Title required.");

            const slug = slugify(title);
            const file = `${date}__${slug}.md`;
            const id = `${date}__${slug}`;

            const data = {
              ...payload.data,
              id,
              date,
              title,
              status: (payload?.data?.status || "active").trim() || "active",
              archive: null,
            };

            await fs.mkdir(entriesDir, { recursive: true });
            const full = path.join(entriesDir, file);

            // refuse overwrite on create
            try {
              await fs.access(full);
              throw new Error("File already exists.");
            } catch {
              // ok
            }

            const md = buildEntryMarkdown(data, payload.body || "");
            await fs.writeFile(full, md, "utf8");

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ file, id }));
            return;
          }

          // API: save
          if (req.method === "POST" && req.url === `${API_BASE}/save`) {
            const payload = await readJson();
            const file = safeBasename(payload.file);
            if (!file) throw new Error("Bad file.");
            const full = path.join(entriesDir, file);

            const existing = await fs.readFile(full, "utf8");
            const { data: oldData } = parseFrontmatter(existing);

            // keep id stable unless missing
            const data = {
              ...payload.data,
              id: oldData.id || payload.data.id || file.replace(/\.md$/, ""),
              archive: oldData.archive ?? null,
            };

            const md = buildEntryMarkdown(data, payload.body || "");
            await fs.writeFile(full, md, "utf8");

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ file }));
            return;
          }

          next();
        } catch (err) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: err?.message || "Error" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    currentsDevGui(),
  ],
});



