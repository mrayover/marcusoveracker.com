import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from "node:path";
import fs from "node:fs/promises";

function currentsDevGui() {
  const GUI_ROUTE = "/__currents";
  const API_BASE = "/__currents/api";

  const root = process.cwd();
  const entriesDir = path.resolve(root, "src/currents/entries");

  // NEW: Currents asset targets (matches your contract)
  const publicImgDir = path.resolve(root, "public/img/currents");
  const publicMp3Dir = path.resolve(root, "public/mp3/currents");


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
      "url_1_text",
      "url_2",
      "url_2_text",
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
          <label style="margin-top:6px;">URL 1 text</label>
          <input id="url_1_text" type="text" placeholder="what the link should say" />
        </div>
        <div>
          <label>URL 2</label>
          <input id="url_2" type="text" />
          <label style="margin-top:6px;">URL 2 text</label>
          <input id="url_2_text" type="text" placeholder="what the link should say" />
        </div>
      </div>


      <div class="row">
        <div>
          <label>Image (top)</label>
          <input id="image_top_file" type="file" accept="image/*" />
          <div class="meta" id="image_top_name"></div>
          <input id="image_top" type="text" placeholder="/img/currents/..." />
        </div>
        <div>
          <label>Image (bottom)</label>
          <input id="image_bottom_file" type="file" accept="image/*" />
          <div class="meta" id="image_bottom_name"></div>
          <input id="image_bottom" type="text" placeholder="/img/currents/..." />
        </div>
      </div>

      <label>Image alt</label>
      <input id="image_alt" type="text" />

      <div class="row">
        <div>
          <label>Audio (top)</label>
          <input id="audio_top_file" type="file" accept="audio/mpeg,audio/mp3" />
          <div class="meta" id="audio_top_name"></div>
          <input id="audio_top" type="text" placeholder="/mp3/currents/...mp3" />
        </div>
        <div>
          <label>Audio (bottom)</label>
          <input id="audio_bottom_file" type="file" accept="audio/mpeg,audio/mp3" />
          <div class="meta" id="audio_bottom_name"></div>
          <input id="audio_bottom" type="text" placeholder="/mp3/currents/...mp3" />
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

    image_top: document.getElementById("image_top"),
    image_bottom: document.getElementById("image_bottom"),
    image_alt: document.getElementById("image_alt"),
    audio_top: document.getElementById("audio_top"),
    audio_bottom: document.getElementById("audio_bottom"),
    audio_caption: document.getElementById("audio_caption"),
    body: document.getElementById("body"),
        url_1_text: document.getElementById("url_1_text"),
    url_2_text: document.getElementById("url_2_text"),

    image_top_file: document.getElementById("image_top_file"),
    image_bottom_file: document.getElementById("image_bottom_file"),
    audio_top_file: document.getElementById("audio_top_file"),
    audio_bottom_file: document.getElementById("audio_bottom_file"),

    image_top_name: document.getElementById("image_top_name"),
    image_bottom_name: document.getElementById("image_bottom_name"),
    audio_top_name: document.getElementById("audio_top_name"),
    audio_bottom_name: document.getElementById("audio_bottom_name"),

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
        els.image_top.value = "";
    els.image_bottom.value = "";
    els.image_alt.value = "";
    els.audio_top.value = "";
    els.audio_bottom.value = "";
    els.audio_caption.value = "";
    els.body.value = "";
        els.url_1_text.value = "";
    els.url_2_text.value = "";

    els.image_top_file.value = "";
    els.image_bottom_file.value = "";
    els.audio_top_file.value = "";
    els.audio_bottom_file.value = "";

    els.image_top_name.textContent = "";
    els.image_bottom_name.textContent = "";
    els.audio_top_name.textContent = "";
    els.audio_bottom_name.textContent = "";

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
  
li.innerHTML = \`
  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
    <div>
      <div><strong>\${it.title || it.file}</strong></div>
      <div class="meta">\${it.date || ""} · <span class="status">\${it.status || "active"}</span></div>
    </div>
    <button
      type="button"
      data-del="\${it.file}"
      style="padding:6px 8px;border-radius:10px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer;"
      title="Delete this entry"
    >Delete</button>
  </div>
\`;

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
        els.image_top.value = payload.data.image_top || "";
        els.image_bottom.value = payload.data.image_bottom || "";
        els.image_alt.value = payload.data.image_alt || "";
        els.audio_top.value = payload.data.audio_top || "";
        els.audio_bottom.value = payload.data.audio_bottom || "";
        els.audio_caption.value = payload.data.audio_caption || "";
        els.body.value = payload.body || "";
                els.url_1_text.value = payload.data.url_1_text || "";
        els.url_2_text.value = payload.data.url_2_text || "";

        els.image_top_name.textContent = payload.data.image_top ? ("image_top: " + payload.data.image_top) : "";
        els.image_bottom_name.textContent = payload.data.image_bottom ? ("image_bottom: " + payload.data.image_bottom) : "";
        els.audio_top_name.textContent = payload.data.audio_top ? ("audio_top: " + payload.data.audio_top) : "";
        els.audio_bottom_name.textContent = payload.data.audio_bottom ? ("audio_bottom: " + payload.data.audio_bottom) : "";

        setMsg("Loaded: " + it.file);
      });
            // delete button (stop row-click)
      const delBtn = li.querySelector('button[data-del]');
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (!confirm(\`DELETE this entry?\n\n\${it.file}\n\nThis cannot be undone.\`)) return;

        const r = await fetch(API + "/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ file: it.file }),
        });

        const out = await r.json().catch(() => ({}));
        if (!r.ok) return setMsg(out.error || "Delete failed.");

        if (currentFile === it.file) blank();

        setMsg("Deleted: " + it.file);
        await loadList();
      });

      els.list.appendChild(li);
    }
    setMsg("Loaded entries list.");
  };
  async function upload(kind, file) {
    const name = file.name;
    const buf = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buf));

    const res = await fetch(API + "/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, name, bytes }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Upload failed.");
    return out.savedAs; // filename only
  }
  els.image_top_file.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const savedAs = await upload("image", f);
    els.image_top.value = "/img/currents/" + savedAs;   // IMPORTANT: matches build-currents normalize rules
    els.image_top_name.textContent = "image_top: " + els.image_top.value;
  });

  els.image_bottom_file.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const savedAs = await upload("image", f);
    els.image_bottom.value = "/img/currents/" + savedAs;
    els.image_bottom_name.textContent = "image_bottom: " + els.image_bottom.value;
  });

  els.audio_top_file.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const savedAs = await upload("audio", f);
    els.audio_top.value = "/mp3/currents/" + savedAs;
    els.audio_top_name.textContent = "audio_top: " + els.audio_top.value;
  });

  els.audio_bottom_file.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const savedAs = await upload("audio", f);
    els.audio_bottom.value = "/mp3/currents/" + savedAs;
    els.audio_bottom_name.textContent = "audio_bottom: " + els.audio_bottom.value;
  });


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
        url_1_text: els.url_1_text.value,
        url_2_text: els.url_2_text.value,
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
          // API: upload (images + mp3 to public/)
          if (req.method === "POST" && req.url === `${API_BASE}/upload`) {
            const payload = await readJson();
            const kind = payload.kind;
            const name = safeBasename(payload.name);
            const bytes = payload.bytes;

            if (!name) throw new Error("Invalid file name.");
            if (!Array.isArray(bytes)) throw new Error("Invalid bytes.");
            if (kind !== "image" && kind !== "audio") throw new Error("Invalid kind.");

            const dir = kind === "image" ? publicImgDir : publicMp3Dir;
            await fs.mkdir(dir, { recursive: true });

            const outPath = path.join(dir, name);
            await fs.writeFile(outPath, Buffer.from(bytes), { encoding: "binary" });

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: true, savedAs: name }));
            return;
          }

          // API: delete
          if (req.method === "POST" && req.url === `${API_BASE}/delete`) {
            const payload = await readJson();
            const file = safeBasename(payload.file);
            if (!file) throw new Error("Bad file.");
            const full = path.join(entriesDir, file);

            // refuse if missing
            try {
              await fs.access(full);
            } catch {
              throw new Error("File not found.");
            }

            await fs.unlink(full);

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: true, file }));
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
function worksDevGui() {
  const GUI_ROUTE = "/__works";
  const API_BASE = "/__works/api";

  const root = process.cwd();
  const entriesDir = path.resolve(root, "src/works/entries");
  const publicImgDir = path.resolve(root, "public/img/works");
  const publicMp3Dir = path.resolve(root, "public/mp3/works");

  const safeBasename = (name) => {
    const base = path.basename(name || "");
    if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
    return base;
  };

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

      if (val === "null") { data[key] = null; continue; }

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

  const buildMd = (fields, body) => {
    const q = (s) => `"${String(s ?? "").replaceAll(`"`, `\\"`)}"`;
    const nul = (v) => (v === null || v === "" ? "null" : q(v));

    const lines = [
      "---",
      `id: ${q(fields.id)}`,
      `title: ${q(fields.title)}`,
      `status: ${q(fields.status)}`,
      `year: ${q(fields.year)}`,
      `instrumentation: ${q(fields.instrumentation)}`,
      `duration: ${nul(fields.duration)}`,
      `revised: ${fields.revised ? q(fields.revised) : "null"}`,
      `image: ${fields.image ? q(fields.image) : q("")}`,
      `image_alt: ${fields.image_alt ? q(fields.image_alt) : q("")}`,
      `audio: ${fields.audio ? q(fields.audio) : q("")}`,
      `audio_caption: ${fields.audio_caption ? q(fields.audio_caption) : q("")}`,
      "---",
      (body || "").trim(),
      "",
    ];
    return lines.join("\n");
  };

  const htmlPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Works Editor (Local)</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 24px auto; padding: 0 16px; }
    label { display:block; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#444; margin-top:12px; }
    input, select, textarea { width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; }
    textarea { min-height:140px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .row { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
    .actions { margin-top:16px; display:flex; gap:12px; align-items:center; }
    button { padding:10px 14px; border:1px solid #000; background:#000; color:#fff; border-radius:6px; cursor:pointer; }
    button.secondary { background:#fff; color:#000; }
    .list { margin-top:28px; border-top:1px solid #eee; padding-top:16px; }
    .item { padding:10px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between; gap:12px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px; color:#555; }
    small { color:#666; }
  </style>
</head>
<body>
  <h1>Works Editor (Local)</h1>
  <p><small>Writes to <span class="mono">src/works/entries/</span> and uploads assets to <span class="mono">public/img/works/</span> + <span class="mono">public/mp3/works/</span>.</small></p>

  <div class="row">
    <div>
      <label>Entry file (md)</label>
      <input id="file" placeholder="2025__example-work.md" />
    </div>
    <div>
      <label>Status</label>
      <select id="status">
        <option value="in-progress">in-progress</option>
        <option value="in-revision">in-revision</option>
        <option value="completed">completed</option>
      </select>
    </div>
  </div>

  <label>Title</label>
  <input id="title" />

  <label>Instrumentation</label>
  <input id="instrumentation" placeholder="e.g., solo guitar / piano quintet / ..." />

  <div class="row">
    <div>
      <label>Year</label>
      <input id="year" placeholder="YYYY" />
    </div>
    <div>
      <label>Duration</label>
      <input id="duration" placeholder='~12 min or 12:30' />
    </div>
  </div>

  <div class="row">
    <div>
      <label>Revised (YYYY-MM-DD)</label>
      <input id="revised" placeholder="optional" />
    </div>
    <div>
      <label>Image alt</label>
      <input id="image_alt" placeholder="optional" />
    </div>
  </div>

  <div class="row">
    <div>
      <label>Image upload (optional)</label>
      <input id="image_file" type="file" accept="image/*" />
      <div class="mono" id="image_name"></div>
    </div>
    <div>
      <label>MP3 upload (optional)</label>
      <input id="audio_file" type="file" accept="audio/mpeg,audio/mp3" />
      <div class="mono" id="audio_name"></div>
    </div>
  </div>

  <label>Audio caption (optional)</label>
  <input id="audio_caption" />

  <label>Notes (markdown body)</label>
  <textarea id="body"></textarea>

  <div class="actions">
    <button id="save">Save</button>
    <button class="secondary" id="new">New</button>
  </div>

  <div class="list">
    <h2>Existing entries</h2>
    <div id="items"></div>
  </div>

<script>
const api = (p) => "${API_BASE}" + p;

function qs(id){ return document.getElementById(id); }

async function list() {
  const res = await fetch(api("/list"));
  const data = await res.json();
  const items = qs("items");
  items.innerHTML = "";
  for (const it of data.items) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = \`
      <div>
        <div><strong>\${it.title || it.file}</strong></div>
        <div class="mono">\${it.file} · \${it.status || ""} · \${it.year || ""}</div>
      </div>
      <div>
        <button class="secondary" data-open="\${it.file}">Open</button>
      </div>
    \`;
    items.appendChild(el);
  }

  items.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", async () => openFile(btn.getAttribute("data-open")));
  });
}

function guessIdFromFile(file) {
  return (file || "").replace(/\\.md$/i, "").trim();
}

async function openFile(file) {
  const res = await fetch(api("/read?file=" + encodeURIComponent(file)));
  const data = await res.json();
  if (data.error) { alert(data.error); return; }

  const md = data.md || "";
  const m = md.match(/^---\\s*\\n([\\s\\S]*?)\\n---\\s*\\n?/);
  let fm = "", body = md;
  if (m) {
    fm = m[1];
    body = md.slice(m[0].length);
  }

  // super minimal parse for the editor UI
  const fields = {};
  for (const line of fm.split("\\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    v = v === "null" ? "" : v.replace(/^"(.*)"$/, "$1");
    fields[k] = v;
  }

  qs("file").value = file;
  qs("status").value = fields.status || "in-progress";
  qs("title").value = fields.title || "";
  qs("instrumentation").value = fields.instrumentation || "";
  qs("year").value = fields.year || "";
  qs("duration").value = fields.duration || "";
  qs("revised").value = fields.revised || "";
  qs("image_alt").value = fields.image_alt || "";
  qs("audio_caption").value = fields.audio_caption || "";
  qs("body").value = (body || "").trim();

  qs("image_name").textContent = fields.image ? ("image: " + fields.image) : "";
  qs("audio_name").textContent = fields.audio ? ("audio: " + fields.audio) : "";
}

async function upload(kind, file) {
  const name = file.name;
  const buf = await file.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buf));
  const res = await fetch(api("/upload"), {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ kind, name, bytes })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.savedAs;
}

qs("image_file").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const savedAs = await upload("image", f);
  qs("image_name").textContent = "image: " + savedAs;
  qs("image_name").dataset.value = savedAs;
});

qs("audio_file").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const savedAs = await upload("audio", f);
  qs("audio_name").textContent = "audio: " + savedAs;
  qs("audio_name").dataset.value = savedAs;
});

qs("save").addEventListener("click", async () => {
  const file = qs("file").value.trim();
  if (!file) { alert("File is required."); return; }
  if (!file.toLowerCase().endsWith(".md")) { alert("File must end with .md"); return; }

  const id = guessIdFromFile(file);
  const payload = {
    file,
    md: null,
  };

  const fields = {
    id,
    title: qs("title").value.trim(),
    status: qs("status").value,
    year: qs("year").value.trim(),
    instrumentation: qs("instrumentation").value.trim(),
    duration: qs("duration").value.trim(),
    revised: qs("revised").value.trim(),
    image: qs("image_name").dataset.value || "",
    image_alt: qs("image_alt").value.trim(),
    audio: qs("audio_name").dataset.value || "",
    audio_caption: qs("audio_caption").value.trim(),
  };

  if (!fields.title) { alert("Title is required."); return; }
  if (!fields.year) { alert("Year is required."); return; }
  if (!fields.instrumentation) { alert("Instrumentation is required."); return; }

  const body = qs("body").value;

  const res = await fetch(api("/save"), {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ file, fields, body })
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }

  await list();
  alert("Saved.");
});

qs("new").addEventListener("click", () => {
  qs("file").value = "";
  qs("status").value = "in-progress";
  qs("title").value = "";
  qs("instrumentation").value = "";
  qs("year").value = "";
  qs("duration").value = "";
  qs("revised").value = "";
  qs("image_alt").value = "";
  qs("audio_caption").value = "";
  qs("body").value = "";
  qs("image_name").textContent = "";
  qs("audio_name").textContent = "";
  delete qs("image_name").dataset.value;
  delete qs("audio_name").dataset.value;
  qs("image_file").value = "";
  qs("audio_file").value = "";
});

list();
</script>
</body>
</html>`;

  return {
    name: "works-dev-gui",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          // GUI page
          if (req.url === GUI_ROUTE || req.url?.startsWith(GUI_ROUTE + "?")) {
            res.statusCode = 200;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(htmlPage);
            return;
          }

          // API: list
          if (req.url === API_BASE + "/list") {
            await fs.mkdir(entriesDir, { recursive: true });
            const files = (await fs.readdir(entriesDir))
              .filter(f => f.toLowerCase().endsWith(".md"))
              .sort();

            const items = [];
            for (const file of files) {
              const md = await fs.readFile(path.join(entriesDir, file), "utf8");
              const { data } = parseFrontmatter(md);
              items.push({
                file,
                title: data.title || "",
                status: data.status || "",
                year: data.year || "",
              });
            }

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ items }));
            return;
          }

          // API: read
          if (req.url?.startsWith(API_BASE + "/read")) {
            const u = new URL(req.url, "http://localhost");
            const file = safeBasename(u.searchParams.get("file"));
            if (!file) throw new Error("Invalid file.");
            const full = path.join(entriesDir, file);
            const md = await fs.readFile(full, "utf8");

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ file, md }));
            return;
          }

          // API: save
          if (req.url === API_BASE + "/save" && req.method === "POST") {
            let raw = "";
            req.on("data", (c) => (raw += c));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(raw || "{}");
                const file = safeBasename(payload.file);
                if (!file) throw new Error("Invalid file name.");

                const fields = payload.fields || {};
                const body = payload.body || "";

                await fs.mkdir(entriesDir, { recursive: true });
                const md = buildMd(fields, body);
                await fs.writeFile(path.join(entriesDir, file), md, "utf8");

                res.statusCode = 200;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ ok: true, file }));
              } catch (err) {
                res.statusCode = 400;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: err?.message || "Error" }));
              }
            });
            return;
          }

          // API: upload
          if (req.url === API_BASE + "/upload" && req.method === "POST") {
            let raw = "";
            req.on("data", (c) => (raw += c));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(raw || "{}");
                const kind = payload.kind;
                const name = safeBasename(payload.name);
                const bytes = payload.bytes;

                if (!name) throw new Error("Invalid file name.");
                if (!Array.isArray(bytes)) throw new Error("Invalid bytes.");
                if (kind !== "image" && kind !== "audio") throw new Error("Invalid kind.");

                const dir = kind === "image" ? publicImgDir : publicMp3Dir;
                await fs.mkdir(dir, { recursive: true });

                const outPath = path.join(dir, name);
                await fs.writeFile(outPath, Buffer.from(bytes), { encoding: "binary" });

                res.statusCode = 200;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ ok: true, savedAs: name }));
              } catch (err) {
                res.statusCode = 400;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: err?.message || "Error" }));
              }
            });
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
    worksDevGui(),
  ],
build: {
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), "index.html"),
        works: path.resolve(process.cwd(), "works.html"),
        currents: path.resolve(process.cwd(), "currents.html"),
        about: path.resolve(process.cwd(), "about.html"),
        contact: path.resolve(process.cwd(), "contact.html"),
        emerge: path.resolve(__dirname, 'emerge.html'),
        links: path.resolve(process.cwd(), "links.html"), 
        "works-admin": path.resolve(process.cwd(), "works-admin.html"),
      },
    },
  },
});



