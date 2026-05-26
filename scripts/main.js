/* ---------- 1. PARSER: handles clean JSON + RTF-wrapped JSON ---------- */
function extractJSON(raw) {
  raw = raw.replace(/^\uFEFF/, "");
  const looksRTF = raw.trimStart().startsWith("{\\rtf") || raw.includes("\\cocoartf") || raw.includes("\\rtf1");
  if (!looksRTF) return JSON.parse(raw);

  // Find start of the embedded JSON (RTF escapes braces as \{ and \})
  let i = raw.search(/\\\{/);
  if (i === -1) i = raw.indexOf('{"');
  let body = raw.slice(i);
  // Unescape RTF braces
  body = body.replace(/\\\{/g, "{").replace(/\\\}/g, "}");
  // Convert RTF hex escapes like \'97 (em dash) to real chars
  const cp1252 = { "91": "\u2018", "92": "\u2019", "93": "\u201C", "94": "\u201D", "96": "\u2013", "97": "\u2014", "85": "\u2026", "a0": "\u00A0" };
  body = body.replace(/\\'([0-9a-fA-F]{2})/g, (m, h) => cp1252[h.toLowerCase()] || String.fromCharCode(parseInt(h, 16)));
  // Strip any remaining RTF control words / line continuations
  body = body.replace(/\\[a-z]+-?\d* ?/g, "").replace(/\\\n/g, "");

  // Extract the first balanced JSON object (ignoring braces inside strings)
  const start = body.indexOf("{");
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = start; k < body.length; k++) {
    const c = body[k];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  return JSON.parse(body.slice(start, end === -1 ? body.length : end));
}

/* ---------- 2. STATE + DEFAULTS ---------- */
const TABS = ["Checklist", "Pipeline", "Projects", "Interview prep", "Notes"];
const STAGES = ["Researching / Recruiters reached out", "Applied / Tech recruiter Screening", "Phone screen", "Onsite", "Offer"];
const PREP_META = {
  behavioral: { label: "Behavioral", weight: "HIGHEST WEIGHT" },
  sysdesign:  { label: "System design", weight: "HIGH" },
  strategy:   { label: "Org / strategy", weight: "MEDIUM-HIGH" },
  coding:     { label: "Coding + narration", weight: "MEDIUM" },
};

let data = null;
let activeTab = "Checklist";
let fileName = "data.json";
let noteDraft = "";

const SAMPLE = {
  checklist: [
    { id: "c1", text: "Finalize resume — quantify all bullets", done: false },
    { id: "c2", text: "Update LinkedIn headline + About section", done: false },
    { id: "c3", text: "Set LinkedIn Open to Work (hidden from current employer)", done: false },
    { id: "c4", text: "Prepare 3 STAR behavioral stories (cross-team impact)", done: false },
    { id: "c5", text: "Practice live system design: AI-powered support platform", done: false },
    { id: "c6", text: "Write cover letter template (customizable)", done: false },
    { id: "c7", text: "Prep negotiation anchor numbers (base + equity + bonus)", done: false },
    { id: "c8", text: "Reach out to 5 LinkedIn contacts this week", done: false },
  ],
  pipeline: [],
  projects: [{ id: "p1", name: "Job Search HQ", status: "In Progress", desc: "AI-assisted job search workflow with Claude" }],
  prep: {
    behavioral: [
      { id: "b1", text: "Led initiative that changed org direction — Intuit Assist story", done: false },
      { id: "b2", text: "Navigated conflict with cross-functional stakeholder", done: false },
      { id: "b3", text: "Mentored engineer to promotion / ownership", done: false },
      { id: "b4", text: "Delivered under ambiguity with incomplete requirements", done: false },
    ],
    sysdesign: [
      { id: "s1", text: "Design AI-powered support chatbot at 13M user scale", done: false },
      { id: "s2", text: "Design request deduplication + caching layer (xAPI pattern)", done: false },
      { id: "s3", text: "Multi-agent orchestration: PSA + AQnA architecture", done: false },
    ],
    coding: [
      { id: "co1", text: "LRU Cache implementation with narration", done: false },
      { id: "co2", text: "Rate limiter (token bucket + sliding window)", done: false },
      { id: "co3", text: "Debounce / throttle from scratch", done: false },
    ],
    strategy: [
      { id: "st1", text: "How would you evaluate build vs buy for AI tooling?", done: false },
      { id: "st2", text: "How do you drive adoption of a new architecture across teams?", done: false },
      { id: "st3", text: "How do you measure engineering productivity at Staff level?", done: false },
    ],
  },
  notes: [{ id: "id1779738728014b71f", text: "I have applied to Global Relay, Databricks, Stripe", ts: "5/25/2026, 12:52:08 PM" }],
};

/* ---------- 3. FILE LOADING ---------- */
const $ = (id) => document.getElementById(id);

function showError(msg) {
  $("loadErr").innerHTML = `<div class="err"><strong>Couldn't read that file.</strong><br>${esc(msg)}</div>`;
}

function loadData(obj, name) {
  // normalize: ensure all sections exist
  data = {
    checklist: Array.isArray(obj.checklist) ? obj.checklist : [],
    pipeline: Array.isArray(obj.pipeline) ? obj.pipeline : [],
    projects: Array.isArray(obj.projects) ? obj.projects : [],
    prep: obj.prep && typeof obj.prep === "object" ? obj.prep : {},
    notes: Array.isArray(obj.notes) ? obj.notes : [],
  };
  fileName = name || "data.json";
  $("loadErr").innerHTML = "";
  $("loader").style.display = "none";
  $("app").style.display = "block";
  $("fileBadge").textContent = fileName;
  render();
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = extractJSON(String(e.target.result));
      loadData(obj, file.name);
    } catch (err) {
      showError("Parse error: " + err.message + ". Make sure it's the job-search data.json.");
    }
  };
  reader.onerror = () => showError("Failed to read the file.");
  reader.readAsText(file);
}

function wireLoader() {
  // Try to auto-load data.json via fetch (works when served over HTTP)
  fetch('./data.json')
    .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
    .then(obj => loadData(obj, 'data.json'))
    .catch(() => {
      // Fallback: show the dropzone for manual file pick
      const dz = $("dropzone"), input = $("fileInput");
      $("browseBtn").onclick = (e) => { e.stopPropagation(); input.click(); };
      dz.onclick = () => input.click();
      $("sampleBtn").onclick = (e) => { e.stopPropagation(); loadData(JSON.parse(JSON.stringify(SAMPLE)), "sample-data.json"); };
      input.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
      ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
      ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
      dz.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    });
}

/* ---------- 4. RENDER ---------- */
function render() { renderStats(); renderTabs(); renderView(); }

function renderStats() {
  const total = data.pipeline.length;
  const active = data.pipeline.filter(a => (a.stage || a.status) && (a.stage || a.status) !== "Researching / Recruiters reached out").length;
  const offers = data.pipeline.filter(a => (a.stage || a.status) === "Offer").length;
  let items = 0, done = 0;
  data.checklist.forEach(i => { items++; if (i.done) done++; });
  Object.values(data.prep).forEach(g => (g || []).forEach(i => { items++; if (i.done) done++; }));
  const pct = items ? Math.round((done / items) * 100) : 0;
  $("statRow").innerHTML = `
    <div class="stat"><div class="n">${total}</div><div class="l">Pipeline</div></div>
    <div class="stat"><div class="n">${active}</div><div class="l">Active</div></div>
    <div class="stat"><div class="n">${offers}</div><div class="l">Offers</div></div>
    <div class="stat"><div class="n">${pct}%</div><div class="l">Prep</div></div>`;
}

function renderTabs() {
  $("tabs").innerHTML = TABS.map(t => `<button class="tab ${activeTab === t ? "active" : ""}" data-tab="${t}">${t}</button>`).join("");
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => { activeTab = b.dataset.tab; render(); });
}

function renderView() {
  const v = $("view");
  if (activeTab === "Checklist") v.innerHTML = viewChecklist();
  else if (activeTab === "Pipeline") { v.innerHTML = viewPipeline(); wirePipeline(); }
  else if (activeTab === "Projects") v.innerHTML = viewProjects();
  else if (activeTab === "Interview prep") v.innerHTML = viewPrep();
  else if (activeTab === "Notes") { v.innerHTML = viewNotes(); const ta = $("noteDraft"); if (ta) ta.value = noteDraft; }
}

/* Checklist */
function viewChecklist() {
  const total = data.checklist.length, done = data.checklist.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  let html = `<div class="card"><div class="card-title">Setup checklist<span>${done}/${total}</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="card">`;
  if (!total) html += `<div class="empty">No checklist items in this file.</div>`;
  data.checklist.forEach((it, i) => {
    html += `<div class="chk-item">
      <div class="chk-box ${it.done ? "done" : ""}" onclick="toggleChecklist(${i})">${it.done ? "✓" : ""}</div>
      <div class="chk-label ${it.done ? "done" : ""}">${esc(it.text)}</div></div>`;
  });
  return html + `</div>`;
}
function toggleChecklist(i) { data.checklist[i].done = !data.checklist[i].done; render(); }

/* Pipeline */
function normStage(a) {
  const s = a.stage || a.status || "Researching / Recruiters reached out";
  return STAGES.includes(s) ? s : "Researching / Recruiters reached out";
}
function viewPipeline() {
  let html = `<div class="card"><div class="card-title">Add application</div>
    <div class="row" style="flex-wrap:wrap">
      <input id="pCo" placeholder="Company" style="flex:1;min-width:120px" />
      <input id="pRo" placeholder="Role" style="flex:1;min-width:120px" />
      <select id="pLv" style="width:auto"><option>Staff</option><option>Sr Staff</option><option>Principal</option><option>Senior</option><option>EM</option><option>?</option></select>
      <button class="btn" id="addAppBtn">Add</button>
    </div></div><div class="board">`;
  STAGES.forEach(stage => {
    const items = data.pipeline.filter(a => normStage(a) === stage);
    html += `<div class="col" data-stage="${stage}"><div class="col-head">${stage}<span>${items.length}</span></div>`;
    items.forEach(a => {
      html += `<div class="app" draggable="true" data-id="${a.id}">
        <div class="co">${esc(a.company || a.co || a.name || "—")}</div>
        <div class="ro">${esc(a.role || a.ro || "")}</div>
        <div class="meta"><span class="pill staff">${esc(a.level || a.lv || "—")}</span>
        <span class="pill del" data-del="${a.id}">remove</span></div></div>`;
    });
    html += `</div>`;
  });
  return html + `</div>`;
}
function wirePipeline() {
  const add = $("addAppBtn");
  if (add) add.onclick = () => {
    const co = $("pCo").value.trim(); if (!co) return;
    data.pipeline.push({ id: "a" + Date.now(), company: co, role: $("pRo").value.trim() || "—", level: $("pLv").value, stage: "Researching / Recruiters reached out" });
    updateFile();
    render();
  };
  document.querySelectorAll("[data-del]").forEach(el => el.onclick = () => { data.pipeline = data.pipeline.filter(a => a.id !== el.dataset.del); render(); });
  let dragId = null;
  document.querySelectorAll(".app").forEach(el => el.addEventListener("dragstart", () => dragId = el.dataset.id));
  document.querySelectorAll(".col").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drop-target"); updateFile();});
    col.addEventListener("dragleave", () => { col.classList.remove("drop-target"); updateFile();});
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("drop-target");
      const a = data.pipeline.find(x => x.id === dragId);
      if (a) { a.stage = col.dataset.stage; delete a.status; updateFile(); render(); }
    });
  });
}

/* Projects */
function viewProjects() {
  const map = { "Not Started": "#ef4444", "In Progress": "#f59e0b", "Done": "#22c55e" };
  const order = ["Not Started", "In Progress", "Done"];
  let html = `<div class="card"><div class="card-title">Add project</div>
    <div class="row" style="flex-wrap:wrap">
      <input id="prName" placeholder="Project name" style="flex:1;min-width:140px" />
      <input id="prDesc" placeholder="Short description" style="flex:2;min-width:160px" />
      <button class="btn" id="addProjBtn">Add</button>
    </div></div><div class="card">`;
  if (!data.projects.length) html += `<div class="empty">No projects in this file.</div>`;
  data.projects.forEach((p, i) => {
    const st = order.includes(p.status) ? p.status : "In Progress";
    html += `<div class="proj">
      <div class="proj-status" style="background:${map[st]}" onclick="cycleProj(${i})" title="${st} — click to cycle"></div>
      <div class="proj-body"><div class="proj-name">${esc(p.name)}</div><div class="proj-desc">${esc(p.desc || "")}</div></div>
      <span class="pill" style="background:var(--panel);color:var(--dim)">${st}</span>
      <span class="del" onclick="delProj(${i})">×</span></div>`;
  });
  html += `</div>`;
  setTimeout(() => {
    const b = $("addProjBtn");
    if (b) b.onclick = () => {
      const n = $("prName").value.trim(); if (!n) return;
      data.projects.push({ id: "p" + Date.now(), name: n, desc: $("prDesc").value.trim(), status: "Not Started" });
      render();
    };
  }, 0);
  return html;
}
function cycleProj(i) { const o = ["Not Started", "In Progress", "Done"]; const p = data.projects[i]; const cur = o.includes(p.status) ? p.status : "In Progress"; p.status = o[(o.indexOf(cur) + 1) % 3]; render(); }
function delProj(i) { data.projects.splice(i, 1); render(); }

/* Interview prep */
function viewPrep() {
  const keys = Object.keys(data.prep);
  if (!keys.length) return `<div class="card"><div class="empty">No prep sections in this file.</div></div>`;
  // order: behavioral, sysdesign, strategy, coding, then any extras
  const ordered = ["behavioral", "sysdesign", "strategy", "coding"].filter(k => data.prep[k]).concat(keys.filter(k => !PREP_META[k]));
  let html = `<div class="ip-grid">`;
  ordered.forEach(key => {
    const meta = PREP_META[key] || { label: key, weight: "" };
    const items = data.prep[key] || [];
    html += `<div class="ip-tile"><span class="w">${esc(meta.weight)}</span><h4>${esc(meta.label)}</h4>`;
    items.forEach((it, i) => {
      html += `<div class="ip-row">
        <div class="chk-box ${it.done ? "done" : ""}" onclick="togglePrep('${key}',${i})">${it.done ? "✓" : ""}</div>
        <div class="t ${it.done ? "done" : ""}">${esc(it.text)}</div></div>`;
    });
    html += `</div>`;
  });
  return html + `</div>`;
}
function togglePrep(key, i) { data.prep[key][i].done = !data.prep[key][i].done; render(); }

/* Notes */
function viewNotes() {
  let html = `<div class="card"><div class="card-title">Add note</div>
    <textarea id="noteDraft" rows="3" placeholder="Recruiter intel, comp data, interview debrief..." oninput="noteDraft=this.value"></textarea>
    <div class="row" style="margin-top:10px"><button class="btn" id="addNoteBtn">Save note</button></div></div>`;
  html += `<div class="card"><div class="card-title">Saved notes<span>${data.notes.length}</span></div>`;
  if (!data.notes.length) html += `<div class="empty">No notes in this file.</div>`;
  data.notes.slice().reverse().forEach(n => {
    html += `<div class="note"><span class="del" onclick="delNote('${n.id}')">delete</span>
      <div class="t">${esc(n.ts || "")}</div><div class="c">${esc(n.text)}</div></div>`;
  });
  html += `</div>`;
  setTimeout(() => { const b = $("addNoteBtn"); if (b) b.onclick = addNote; }, 0);
  return html;
}
function addNote() {
  const v = (noteDraft || "").trim(); if (!v) return;
  data.notes.push({ id: "id" + Date.now(), text: v, ts: new Date().toLocaleString() });
  updateFile();
  noteDraft = ""; render();
}
async function updateFile(btn = null) { 
    try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data, null, 2)
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        if (btn) btn.textContent = "✓ Saved";
        setTimeout(() => { if (btn) btn.textContent = "💾 Save"; }, 1500);
      } catch (err) {
        alert("Save failed: " + err.message);
      }
}

function delNote(id) { data.notes = data.notes.filter(n => n.id !== id); 
    // save the data to the file
    updateFile();
    render(); }

/* ---------- 5. EXPORT + UTIL ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = fileName.replace(/\.(rtf|txt)$/i, ".json") || "data.json";
  a.click(); URL.revokeObjectURL(a.href);
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }



async function saveToFile() {
  const btn = $("saveBtn");
  updateFile(btn);
}
/* ---------- 6. INIT ---------- */
wireLoader();
$("reloadBtn").onclick = () => {
  $("app").style.display = "none";
  $("loader").style.display = "flex";
  $("fileInput").value = "";
};
$("exportBtn").onclick = exportJSON;
$("saveBtn").onclick = saveToFile;