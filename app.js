// ============================================================
// app.js — בקרת המסך המאוחד
// כניסה, לשוניות לפי תפקיד, עוזר, אישורים, וניהול משתמשים.
// כל קריאה לשרת נושאת את פרטי הכניסה (auth).
// ============================================================

import { personalize } from "./lib/wrap.js";

const $ = id => document.getElementById(id);
const esc = s => (s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const SKEY = "myprime_cs_user";

let me = null;               // {name, email, role, code}
let scope = "all", context = {}, lastMsg = "";
let queue = [], qi = 0;

// ---------- קריאה לשרת ----------
async function api(path, body = {}) {
  const r = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, auth: { email: me?.email, code: me?.code } }),
  });
  return r.json();
}

// ---------- כניסה ----------
$("lGo").onclick = login;
$("lCode").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

async function login() {
  const email = $("lEmail").value.trim(), code = $("lCode").value.trim();
  if (!email || !code) return showErr("נא למלא מייל וקוד");
  $("lGo").disabled = true;
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }) }).then(r => r.json());
    if (r.error) return showErr(r.error);
    me = { ...r, code };
    localStorage.setItem(SKEY, JSON.stringify(me));
    start();
  } catch { showErr("שגיאה בכניסה"); }
  finally { $("lGo").disabled = false; }
}
function showErr(m) { const e = $("lErr"); e.textContent = m; e.style.display = "block"; }

$("logout").onclick = () => { localStorage.removeItem(SKEY); location.reload(); };

// ---------- הפעלה ----------
function start() {
  $("loginScreen").style.display = "none";
  $("app").style.display = "block";
  $("sub").textContent = `${me.name} · ${me.role}`;
  buildTabs();
  poll(); setInterval(poll, 20000);
  if (me.role === "מנהל") loadQueue();
}

function buildTabs() {
  const tabs = [{ id: "Assist", label: "עוזר תשובות" }];
  if (me.role === "מנהל") {
    tabs.push({ id: "Approve", label: "אישורים" });
    tabs.push({ id: "Add", label: "הוספת תשובה" });
    tabs.push({ id: "Users", label: "משתמשים" });
  }
  $("tabs").innerHTML = tabs.map((t, i) =>
    `<button class="chip ${i === 0 ? "on" : ""}" data-t="${t.id}">${t.label}<span class="c" id="q${t.id}" style="display:none"></span></button>`).join("");
  $("tabs").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    [...$("tabs").children].forEach(x => x.classList.toggle("on", x === b));
    ["Assist", "Approve", "Add", "Users"].forEach(id => $("tab" + id).style.display = (id === b.dataset.t ? "block" : "none"));
    if (b.dataset.t === "Approve") loadQueue();
    if (b.dataset.t === "Users") loadUsers();
  };
  if (tabs.length === 1) $("tabs").style.display = "none";
}

// ---------- עוזר התשובות ----------
$("scope").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  scope = b.dataset.v;
  [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
});
$("go").onclick = () => run(true);

function run(fresh) {
  const msg = fresh ? $("msg").value.trim() : lastMsg;
  if (!msg) return;
  if (fresh) { context = scope !== "all" ? { customerType: scope } : {}; lastMsg = msg; }
  $("result").innerHTML = `<div class="spin">חושב…</div>`;
  api("/api/assist", { message: msg, scope, context }).then(renderAssist)
    .catch(() => $("result").innerHTML = `<div class="panel"><span class="badge warn">שגיאה</span></div>`);
}

function renderAssist(res) {
  const box = $("result");
  if (res.error) { box.innerHTML = `<div class="panel"><span class="badge warn">שגיאה: ${esc(res.error)}</span></div>`; return; }

  if (res.mode === "ask") {
    box.innerHTML = `<div class="panel"><div class="lbl">כדי לדייק, כמה דברים קצרים:</div>
      ${res.questions.map(q => `<div style="margin-top:12px"><div style="font-size:14px;margin-bottom:4px">${esc(q.q)}</div>
        ${q.options.map(o => `<button class="qbtn" data-k="${esc(q.key)}" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`).join("")}
    </div>`;
    box.querySelectorAll(".qbtn").forEach(b => b.onclick = () => { context[b.dataset.k] = b.dataset.v; run(false); });
    return;
  }

  if (res.mode === "answer") {
    const body = personalize(res.text, $("cname").value, me.name);
    box.innerHTML = `<div class="panel">
      <span class="badge ok">תשובה מאושרת</span>
      <div class="lbl" style="margin-top:12px">השאלה במאגר</div>
      <div style="font-size:15px;font-weight:500">${esc(res.matchedQuestion || lastMsg)}</div>
      ${res.near ? `<div class="hint">נמצאה בהתאמה קרובה. כדאי לוודא שהתשובה מתאימה.</div>` : ""}
      <div class="lbl" style="margin-top:14px">התשובה המאושרת · מוכנה לשליחה</div>
      <div class="answer" style="background:var(--bg);border-radius:12px;padding:12px 14px">${esc(body)}</div>
      <div class="acts">
        <button class="btn" id="copy">העתקה ושליחה ללקוחה</button>
        <button class="btn soft" id="obj">יש לי השגה</button>
        <span class="meta">· ${esc(res.category || "")}</span>
      </div><div id="objArea"></div></div>`;
    $("copy").onclick = () => copy(body);
    $("obj").onclick = () => {
      const a = $("objArea"); if (a.innerHTML) { a.innerHTML = ""; return; }
      a.innerHTML = `<textarea id="objNote" placeholder="מה לא מדויק / הצעת שיפור…" style="margin-top:10px"></textarea>
        <div class="acts" style="margin-top:8px"><button class="btn ghost" id="objSend">שליחה לאישור</button></div>`;
      $("objSend").onclick = () => submit({ kind: "objection", refId: res.id, note: $("objNote").value.trim() });
    };
    return;
  }

  const f = res.fields || {};
  box.innerHTML = `<div class="panel">
    <span class="badge warn">הצעת ניסוח · לאישור</span>
    <label class="lbl" style="margin-top:12px">השאלה המרכזית · קצרה, כדי שתימצא בפעם הבאה</label>
    <input type="text" id="q2" value="${esc(res.question || "")}"/>
    <label class="lbl" style="margin-top:12px">ניסוחים חלופיים (מופרדים בפסיק)</label>
    <input type="text" id="alt2" value="${esc((res.altPhrasings || []).join(", "))}"/>
    <label class="lbl" style="margin-top:12px">התשובה · אפשר לערוך</label>
    <textarea id="draft">${esc(res.draft || "")}</textarea>
    <label class="lbl" style="margin-top:12px">קטגוריה</label>
    <input type="text" id="cat" value="${esc(f.category || "")}"/>
    <label class="lbl" style="margin-top:12px">סוג לקוחה</label>
    <div class="chips" id="ct">
      ${["לקוחה קיימת", "עדיין לא לקוחה", "שתיהן"].map(o =>
        `<button class="chip ${(f.customerTypes || []).includes(o) ? "on" : ""}" data-v="${o}">${o}</button>`).join("")}
    </div>
    <div class="acts" style="margin-top:16px"><button class="btn" id="send">שליחה לאישור</button></div></div>`;
  $("ct").addEventListener("click", e => { const b = e.target.closest("button"); if (b) b.classList.toggle("on"); });
  $("send").onclick = () => submit({
    kind: "new",
    question: ($("q2").value.trim() || lastMsg).slice(0, 120),
    altPhrasings: $("alt2").value.split(",").map(x => x.trim()).filter(Boolean),
    draft: $("draft").value.trim(),
    fields: { category: $("cat").value.trim(),
      customerTypes: [...$("ct").querySelectorAll(".on")].map(x => x.dataset.v), health: false },
  });
}

function submit(payload) {
  api("/api/submit", payload).then(() => {
    toast("נשלח לאישור");
    $("result").innerHTML = `<div class="panel"><span class="badge ok">נשלח לאישור</span>
      <div class="answer" style="color:var(--muted)">נעדכן כאן כשזה יאושר.</div></div>`;
  }).catch(() => toast("שגיאה בשליחה"));
}

// ---------- אישורים ----------
let editingApproval = false; // נדלק ברגע שמתחילים לערוך תשובה, כדי שרענון לא ימחק

async function loadQueue(silent) {
  const r = await api("/api/approve", { action: "list" });
  const next = r.pending || [];
  const badge = $("qApprove");
  if (badge) { badge.textContent = next.length; badge.style.display = next.length ? "inline" : "none"; }
  // ברענון אוטומטי: לא מציירים מחדש בזמן עריכה, כדי לא לאבד טקסט
  if (silent && (editingApproval || ["ft", "fq", "fa"].includes(document.activeElement?.id))) { queue = queue.length ? queue : next; return; }
  queue = next; qi = 0;
  drawQueue();
}
function drawQueue() {
  if (qi >= queue.length) { $("queue").innerHTML = `<div class="empty">אין פריטים לאישור 🌷</div>`; return; }
  const it = queue[qi];
  $("queue").innerHTML = `<div class="panel">
    <div class="acts" style="margin-bottom:8px">
      <span class="badge warn">ממתין לאישור · ${qi + 1} מתוך ${queue.length}</span>
      <span class="meta">· ${esc(it.category || "")} · ${esc(it.customerType || "")} · הכינה: ${esc(it.source || "")}</span>
    </div>
    <label class="lbl">השאלה המרכזית · קצרה, כדי שתימצא בפעם הבאה</label>
    <input type="text" id="fq" value="${esc(it.question || "")}"/>
    <label class="lbl" style="margin-top:10px">ניסוחים חלופיים (מופרדים בפסיק)</label>
    <input type="text" id="fa" value="${esc((it.alt || "").split(";").map(x => x.trim()).filter(Boolean).join(", "))}"/>
    <label class="lbl" style="margin-top:10px">התשובה · אפשר לערוך</label>
    <textarea id="ft" style="min-height:150px">${esc(it.text || "")}</textarea>
    <div class="row" style="margin-top:14px">
      <button class="btn" id="ok">אישור · יעלה לאוויר</button>
      <button class="btn soft" id="ret">החזרה לטלי</button>
    </div></div>`;
  editingApproval = false;
  ["ft", "fq", "fa"].forEach(id => $(id) && $(id).addEventListener("input", () => { editingApproval = true; }));
  $("ok").onclick = () => qAct("approve", {
    finalText: $("ft").value.trim(),
    question: $("fq").value.trim(),
    altPhrasings: $("fa").value.split(",").map(x => x.trim()).filter(Boolean).join("; "),
  });
  $("ret").onclick = () => qAct("return", { note: prompt("הערה לטלי (לא חובה):") || "" });
}
function qAct(action, extra) {
  const it = queue[qi];
  api("/api/approve", { action, id: it.id, to: it.source || "טלי", ...extra })
    .then(() => { toast(action === "approve" ? "אושר ועלה לאוויר" : "הוחזר"); editingApproval = false; qi++; drawQueue(); })
    .catch(() => toast("שגיאה"));
}

// ---------- ניהול משתמשים ----------
async function loadUsers() {
  const r = await api("/api/users", { action: "list" });
  const users = r.users || [];
  $("usersList").innerHTML = users.map(u => `<div class="panel" style="padding:13px 15px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-weight:600">${esc(u.name)} <span class="meta">· ${esc(u.role)}</span></div>
        <div class="meta">${esc(u.email)}</div>
        <div class="meta">קוד: <b>${esc(u.code)}</b></div>
      </div>
      <div class="acts">
        <button class="btn soft" data-a="setCode" data-r="${u.row}">שינוי קוד</button>
        <button class="btn soft" data-a="resetCode" data-r="${u.row}">איפוס קוד</button>
        <button class="btn soft" data-a="toggle" data-r="${u.row}" data-v="${u.active ? "0" : "1"}">${u.active ? "חסימה" : "שחרור"}</button>
      </div>
    </div>${u.active ? "" : `<div class="meta" style="color:var(--warn);margin-top:6px">חסום</div>`}</div>`).join("");
  $("usersList").onclick = async e => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const row = Number(b.dataset.r), a = b.dataset.a;
    if (a === "setCode") {
      const code = prompt("קוד חדש:"); if (!code) return;
      await api("/api/users", { action: "setCode", row, code }); toast("הקוד עודכן");
    } else if (a === "resetCode") {
      const r2 = await api("/api/users", { action: "resetCode", row }); toast("קוד חדש: " + r2.code);
    } else {
      await api("/api/users", { action: "toggle", row, active: b.dataset.v === "1" }); toast("עודכן");
    }
    loadUsers();
  };
}
$("uAdd").onclick = async () => {
  const name = $("uName").value.trim(), email = $("uEmail").value.trim();
  if (!name || !email) return toast("נא למלא שם ומייל");
  const r = await api("/api/users", { action: "add", name, email, code: $("uCode").value.trim(), role: $("uRole").value });
  toast("נוסף. קוד: " + r.code);
  $("uName").value = $("uEmail").value = $("uCode").value = "";
  loadUsers();
};

// ---------- הוספת תשובה ידנית (מנהל) ----------
["aCt", "aKind"].forEach(id => {
  const el = $(id); if (!el) return;
  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (id === "aKind") [...el.children].forEach(x => x.classList.toggle("on", x === b));
    else b.classList.toggle("on");
  });
});
if ($("aSave")) $("aSave").onclick = async () => {
  const q = $("aQ").value.trim(), body = $("aBody").value.trim();
  if (!q || !body) return toast("נא למלא שאלה ותשובה");
  const r = await api("/api/submit", {
    kind: "direct", question: q, draft: body,
    altPhrasings: $("aAlt").value.split(",").map(x => x.trim()).filter(Boolean),
    fields: {
      category: $("aCat").value.trim(),
      customerTypes: [...$("aCt").querySelectorAll(".on")].map(x => x.dataset.v),
      kind: $("aKind").querySelector(".on")?.dataset.v || "מענה",
      health: false,
    },
  });
  if (r.error) return toast("שגיאה: " + r.error);
  toast("נוסף למאגר · " + r.id);
  $("aQ").value = $("aAlt").value = $("aBody").value = $("aCat").value = "";
};

// ---------- כלים והתראות ----------
function copy(t, m) { navigator.clipboard.writeText(t).then(() => toast(m || "הועתק")); }
let tt; function toast(m) { const e = $("toast"); e.textContent = m; e.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("show"), 2200); }

$("bell").onclick = () => { const n = $("notifs"); n.style.display = n.style.display === "none" ? "block" : "none"; };
async function poll() {
  try {
    const r = await fetch(`/api/notifications?to=${encodeURIComponent(me.name)}`).then(r => r.json());
    const items = r.items || [];
    $("bc").textContent = items.length; $("bc").style.display = items.length ? "inline" : "none";
    $("notifs").innerHTML = items.length
      ? items.map(n => `<div class="notif"><b>${esc(n.type)}</b><div class="t">${esc(n.text)}</div>
          ${n.ref ? `<div class="acts" style="margin-top:8px"><button class="btn soft" data-ref="${esc(n.ref)}">צפייה בתשובה</button></div>` : ""}
        </div>`).join("")
      : `<div class="empty">אין התראות</div>`;
    if (me.role === "מנהל") loadQueue(true);
  } catch {}
}

// פתיחת תשובה מתוך התראה
$("notifs").addEventListener("click", async e => {
  const b = e.target.closest("button[data-ref]"); if (!b) return;
  const r = await api("/api/record", { id: b.dataset.ref });
  if (r.error) return toast(r.error);
  $("notifs").style.display = "none";
  [...$("tabs").children].forEach((x, i) => x.classList.toggle("on", i === 0));
  ["Assist", "Approve", "Add", "Users"].forEach(id => { const el = $("tab" + id); if (el) el.style.display = (id === "Assist" ? "block" : "none"); });
  lastMsg = r.question || "";
  renderAssist({ mode: "answer", id: r.id, text: r.text, category: r.category, matchedQuestion: r.question });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- שחזור כניסה קודמת ----------
try {
  const saved = JSON.parse(localStorage.getItem(SKEY) || "null");
  if (saved && saved.email && saved.code) { me = saved; start(); }
} catch {}
