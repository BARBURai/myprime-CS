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
  setupPush();
  openFromUrl();
  if (me.role === "מנהל") loadQueue();
}

const SECTIONS = [
  { id: "Assist",  icon: "💬", title: "עוזר תשובות",  sub: "הדביקי הודעה של לקוחה וקבלי תשובה מוכנה" },
  { id: "Browse",  icon: "📚", title: "מאגר התשובות", sub: "כל התשובות הקיימות, עם חיפוש וסינון" },
  { id: "Approve", icon: "✅", title: "אישורים",      sub: "פריטים שממתינים לאישור שלך", admin: true },
  { id: "Add",     icon: "➕", title: "הוספת תשובה",  sub: "הוספה ישירה למאגר, נכנסת כמאושרת", admin: true },
  { id: "Users",   icon: "👥", title: "משתמשים",      sub: "הרשאות, קודים אישיים וחסימה", admin: true },
];

let current = "Assist";
const mySections = () => SECTIONS.filter(x => !x.admin || me.role === "מנהל");

function buildTabs() {
  $("nav").innerHTML = mySections().map(x => `
    <button data-t="${x.id}">
      <span class="em">${x.icon}</span>${x.title}
      ${x.id === "Approve" ? `<span class="cnt" id="qApprove" style="display:none"></span>` : ""}
    </button>`).join("");
  $("nav").onclick = e => {
    const b = e.target.closest("button[data-t]"); if (b) showSection(b.dataset.t);
  };
  showSection("Assist");
}

function showSection(id) {
  current = id;
  SECTIONS.forEach(x => { const el = $("tab" + x.id); if (el) el.style.display = (x.id === id ? "block" : "none"); });
  [...$("nav").children].forEach(b => b.classList.toggle("on", b.dataset.t === id));
  const sec = SECTIONS.find(x => x.id === id);
  $("sectionTitle").innerHTML = `<span class="tt">${sec.icon} ${sec.title}</span><span class="ss">${sec.sub}</span>`;
  if (id === "Approve") loadQueue();
  if (id === "Browse") loadBrowse();
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
      a.innerHTML = `
        <label class="lbl" style="margin-top:12px">מה לא מדויק</label>
        <textarea id="objNote" placeholder="בקצרה, מה הבעיה בתשובה הנוכחית…"></textarea>
        <label class="lbl" style="margin-top:10px">הצעת נוסח מתוקן (לא חובה)</label>
        <textarea id="objDraft" style="min-height:120px">${esc(res.text || "")}</textarea>
        <div class="hint">אפשר לערוך ישירות את הנוסח כאן. רון יראה השוואה בין הקיים למוצע.</div>
        <div class="acts" style="margin-top:10px"><button class="btn ghost" id="objSend">שליחה לאישור</button></div>`;
      $("objSend").onclick = () => {
        const proposed = $("objDraft").value.trim();
        submit({
          kind: "objection", refId: res.id,
          note: $("objNote").value.trim(),
          draft: proposed && proposed !== (res.text || "").trim() ? proposed : "",
        });
      };
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
let queueStatus = "ממתין לאישור";

// מתג הסטטוס בתור האישורים
if ($("qFilter")) $("qFilter").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  [...$("qFilter").children].forEach(x => x.classList.toggle("on", x === b));
  queueStatus = b.dataset.v; queue = []; qi = 0; editingApproval = false;
  loadQueue();
});

async function loadQueue(silent) {
  const r = await api("/api/approve", { action: "list", statuses: [queueStatus] });
  // מספרים על כל כפתור סטטוס
  if (r.counts && $("qFilter")) {
    [...$("qFilter").children].forEach(b => {
      const n = r.counts[b.dataset.v] || 0;
      b.textContent = b.textContent.replace(/\s*\(\d+\)$/, "") + ` (${n})`;
    });
  }
  const next = r.pending || [];
  const waiting = (r.counts && r.counts["ממתין לאישור"]) || 0;
  const badge = $("qApprove");
  if (badge) { badge.textContent = waiting; badge.style.display = waiting ? "inline" : "none"; }
  // ברענון אוטומטי: לא מציירים מחדש בזמן עריכה, כדי לא לאבד טקסט
  if (silent && (editingApproval || ["ft", "fq", "fa"].includes(document.activeElement?.id))) { queue = queue.length ? queue : next; return; }
  queue = next; qi = 0;
  drawQueue();
}
function drawQueue() {
  if (qi >= queue.length) {
    $("queue").innerHTML = `<div class="empty">אין פריטים בסטטוס «${esc(queueStatus)}» 🌷</div>`;
    return;
  }
  const it = queue[qi];
  $("queue").innerHTML = `<div class="panel">
    <div class="acts" style="margin-bottom:8px">
      <span class="badge warn">${esc(queueStatus)} · ${qi + 1} מתוך ${queue.length}</span>
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

if ($("qMode")) $("qMode").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
  includeDrafts = !!b.dataset.v;
  queue = []; qi = 0; editingApproval = false;
  loadQueue();
});

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


// ---------- השוואת נוסחים: מה נמחק ומה נוסף ----------
/** מפרק לטוקנים של מילים ורווחים, כדי לשמור על מבנה הטקסט */
function tokens(t) {
  return (t || "").split(/(\s+)/).filter(x => x !== "");
}

/** השוואה ברמת המילה, מבוססת רצף משותף ארוך ביותר */
function wordDiff(oldText, newText) {
  const a = tokens(oldText), b = tokens(newText);
  const n = a.length, m = b.length;
  // טבלת אורכים של רצף משותף
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: "same", v: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "del", v: a[i] }); i++; }
    else { out.push({ t: "ins", v: b[j] }); j++; }
  }
  while (i < n) out.push({ t: "del", v: a[i++] });
  while (j < m) out.push({ t: "ins", v: b[j++] });
  return out;
}

/** מקבץ את ההשוואה ליחידות: קטע זהה, או שינוי (הוסר מול נוסף) */
function buildChunks(oldText, newText) {
  const parts = wordDiff(oldText, newText);
  const chunks = [];
  let dels = [], ins = [];
  const flush = () => {
    if (dels.length || ins.length) {
      chunks.push({ type: "change", del: dels.join(""), ins: ins.join("") });
      dels = []; ins = [];
    }
  };
  for (const p of parts) {
    if (p.t === "same") { flush(); 
      if (chunks.length && chunks[chunks.length - 1].type === "same") chunks[chunks.length - 1].text += p.v;
      else chunks.push({ type: "same", text: p.v });
    }
    else if (p.t === "del") dels.push(p.v);
    else ins.push(p.v);
  }
  flush();
  return chunks;
}

// ---------- בדיקת השגה: הקיים מול המוצע ----------
function renderObjection(rec, rawText, from) {
  // פענוח טקסט ההתראה: "טלי מעירה על MP-XXX: <הערה>" ואחריו אולי "הצעה: <נוסח>"
  const idx = rawText.indexOf("הצעה:");
  const head = idx >= 0 ? rawText.slice(0, idx) : rawText;
  const proposed = idx >= 0 ? rawText.slice(idx + 5).trim() : "";
  const note = (head.split(":").slice(1).join(":") || head).trim();

  const header = `
    <span class="badge warn">השגה לבדיקה${from ? " · מ" + esc(from) : ""}</span>
    <div class="lbl" style="margin-top:12px">השאלה המקורית במאגר</div>
    <div style="font-size:15.5px;font-weight:600">${esc(rec.question || "")}</div>
    <div class="meta" style="margin-top:5px">${esc(rec.id)} · ${esc(rec.category || "ללא קטגוריה")} · ${esc(rec.customerType || "כל הסוגים")}</div>
    ${rec.alt ? `<div class="meta" style="margin-top:5px">ניסוחים חלופיים: ${esc(rec.alt.split(";").map(x => x.trim()).filter(Boolean).join(" · "))}</div>` : ""}
    <div class="lbl" style="margin-top:14px">מה שנכתב בהשגה</div>
    <div style="background:var(--warn-soft);color:var(--warn);border-radius:12px;padding:11px 13px;font-size:14.5px;white-space:pre-wrap">${esc(note || "בלי הערה")}</div>`;

  const replyRow = `
    <label class="lbl" style="margin-top:14px">הודעה חוזרת${from ? " ל" + esc(from) : ""} (לא חובה)</label>
    <input type="text" id="objReply" placeholder="מילה קצרה שתצורף לעדכון"/>`;

  // ---- אין הצעת נוסח: עריכה חופשית ----
  if (!proposed) {
    $("result").innerHTML = `<div class="panel">${header}
      <div class="lbl" style="margin-top:16px">הנוסח הקיים · אפשר לתקן</div>
      <textarea id="objNew" style="min-height:160px">${esc(rec.text || "")}</textarea>
      ${replyRow}
      <div class="acts" style="margin-top:12px">
        <button class="btn" id="objApprove">שמירת הנוסח</button>
        <button class="btn soft" id="objKeep">להשאיר כמו שהוא</button>
      </div></div>`;
    wireObjectionButtons(rec, from, () => $("objNew").value.trim());
    return;
  }

  // ---- יש הצעה: מעקב שינויים ----
  const chunks = buildChunks(rec.text || "", proposed);
  const state = chunks.map(c => c.type === "change" ? "accepted" : null); // ברירת מחדל: מקבלים

  const finalText = () => chunks.map((c, i) => {
    if (c.type === "same") return c.text;
    return state[i] === "accepted" ? c.ins : c.del;
  }).join("");

  const changeCount = chunks.filter(c => c.type === "change").length;

  function draw() {
    const accepted = state.filter(x => x === "accepted").length;
    $("diffArea").innerHTML = chunks.map((c, i) => {
      if (c.type === "same") return esc(c.text);
      return `<span class="chunk ${state[i]}" data-i="${i}">${
        c.del.trim() ? `<span class="del">${esc(c.del.trim())}</span>` : ""}${
        c.ins.trim() ? `<span class="ins">${esc(c.ins.trim())}</span>` : ""}<span class="btns">
          <button class="yes ${state[i] === "accepted" ? "on" : ""}" data-s="accepted" title="לקבל">✓</button>
          <button class="no ${state[i] === "rejected" ? "on" : ""}" data-s="rejected" title="לדחות">✕</button>
        </span></span> `;
    }).join("");
    $("diffCount").textContent = `${changeCount} שינויים · ${accepted} התקבלו, ${changeCount - accepted} נדחו`;
    $("finalPreview").textContent = finalText();
  }

  $("result").innerHTML = `<div class="panel">${header}
    <div class="lbl" style="margin-top:16px" id="diffCount"></div>
    <div class="diffbox" id="diffArea"></div>
    <div class="difflegend">
      <span><i class="dot" style="background:#E4F1E8;border:1px solid #2F6B48"></i> הצעה של ${esc(from || "הצוות")}</span>
      <span><i class="dot" style="background:#F7E2E4;border:1px solid #9B3B47"></i> הנוסח הקיים</span>
    </div>
    <div class="acts" style="margin-top:10px">
      <button class="btn soft" id="accAll">לקבל הכל</button>
      <button class="btn soft" id="rejAll">לדחות הכל</button>
    </div>
    <div class="lbl" style="margin-top:16px">הנוסח הסופי שיישמר</div>
    <div class="finalbox" id="finalPreview"></div>
    ${replyRow}
    <div class="acts" style="margin-top:12px">
      <button class="btn" id="objApprove">שמירת הנוסח הסופי</button>
      <button class="btn soft" id="objKeep">ביטול · להשאיר כמו שהוא</button>
    </div></div>`;

  draw();

  $("diffArea").addEventListener("click", e => {
    const btn = e.target.closest("button[data-s]"); if (!btn) return;
    const i = Number(btn.closest(".chunk").dataset.i);
    state[i] = btn.dataset.s;
    draw();
  });
  $("accAll").onclick = () => { chunks.forEach((c, i) => { if (c.type === "change") state[i] = "accepted"; }); draw(); };
  $("rejAll").onclick = () => { chunks.forEach((c, i) => { if (c.type === "change") state[i] = "rejected"; }); draw(); };

  wireObjectionButtons(rec, from, finalText);
}

/** מחבר את כפתורי השמירה והביטול, כולל עדכון חזרה למגישה */
function wireObjectionButtons(rec, from, getText) {
  $("objApprove").onclick = async () => {
    const text = (getText() || "").trim();
    const r = await api("/api/records", {
      action: "update", id: rec.id, answer: text,
      notify: from || "", decision: "updated", reply: ($("objReply")?.value || "").trim(),
    });
    if (r.error) return toast("שגיאה: " + r.error);
    BROWSE = [];
    toast(from ? `הנוסח עודכן · ${from} קיבלה עדכון` : "הנוסח עודכן במאגר");
    renderAssist({ mode: "answer", id: rec.id, text, category: rec.category, matchedQuestion: rec.question });
  };
  $("objKeep").onclick = async () => {
    const r = await api("/api/records", {
      action: "update", id: rec.id,
      notify: from || "", decision: "kept", reply: ($("objReply")?.value || "").trim(),
    });
    if (r.error) return toast("שגיאה: " + r.error);
    toast(from ? `${from} קיבלה עדכון שהנוסח נשאר` : "נשאר ללא שינוי");
    renderAssist({ mode: "answer", id: rec.id, text: rec.text, category: rec.category, matchedQuestion: rec.question });
  };
}

// ---------- מאגר התשובות ----------
let BROWSE = [], canEdit = false;
let bCat = "", bType = "", bStatus = "";

async function loadBrowse() {
  if (BROWSE.length) return drawBrowse();
  $("bList").innerHTML = `<div class="spin">טוען…</div>`;
  const r = await api("/api/records", { action: "list" });
  if (r.error) { $("bList").innerHTML = `<div class="panel"><span class="badge warn">${esc(r.error)}</span></div>`; return; }
  BROWSE = r.records || []; canEdit = !!r.canEdit;
  if (canEdit) $("bStatusWrap").style.display = "block";
  $("bCat").innerHTML = `<button class="chip on" data-v="">הכול</button>` +
    (r.categories || []).map(c => `<button class="chip" data-v="${esc(c)}">${esc(c)}</button>`).join("");
  drawBrowse();
}

function pickChips(wrapId, setter) {
  const el = $(wrapId); if (!el) return;
  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    [...el.children].forEach(x => x.classList.toggle("on", x === b));
    setter(b.dataset.v); drawBrowse();
  });
}
pickChips("bCat", v => bCat = v);
pickChips("bType", v => bType = v);
pickChips("bStatus", v => bStatus = v);
if ($("bSearch")) $("bSearch").addEventListener("input", () => drawBrowse());

function drawBrowse() {
  const q = ($("bSearch").value || "").trim().toLowerCase();
  const list = BROWSE.filter(r => {
    if (bCat && r.category !== bCat) return false;
    if (bStatus && r.status !== bStatus) return false;
    if (bType) {
      const types = r.customerType.split(";").map(x => x.trim()).filter(Boolean);
      if (!types.includes(bType)) return false;
    }
    if (q && !(r.question + " " + r.alt + " " + r.answer).toLowerCase().includes(q)) return false;
    return true;
  });
  const by = {};
  BROWSE.forEach(r => { by[r.status] = (by[r.status] || 0) + 1; });
  const summary = Object.entries(by).map(([k, v]) => `${k}: ${v}`).join(" · ");
  $("bCount").textContent = `מוצגות ${list.length} מתוך ${BROWSE.length} · ${summary}`;
  $("bList").innerHTML = list.map(r => `<div class="panel" style="padding:14px 16px" data-id="${esc(r.id)}">
      <div class="acts" style="justify-content:space-between">
        <div style="font-size:15px;font-weight:600">${esc(r.question)}</div>
        <span class="badge ${r.status === "מאושר" ? "ok" : "none"}">${esc(r.status)}</span>
      </div>
      <div class="meta" style="margin-top:6px">${esc(r.id)} · ${esc(r.category || "ללא קטגוריה")} · ${esc(r.customerType || "כל הסוגים")}${r.health ? " · בריאותי" : ""}</div>
      <div class="answer" style="background:var(--bg);border-radius:12px;padding:11px 13px;font-size:14.5px">${esc(r.answer)}</div>
      <div class="acts">
        <button class="btn soft" data-a="copy">העתקה</button>
        ${canEdit ? `<button class="btn soft" data-a="edit">עריכה</button>` : ""}
      </div>
      <div class="editArea"></div>
    </div>`).join("") || `<div class="empty">לא נמצאו תשובות מתאימות</div>`;
}

$("bList").addEventListener("click", async e => {
  const btn = e.target.closest("button[data-a]"); if (!btn) return;
  const card = btn.closest(".panel"), id = card.dataset.id;
  const rec = BROWSE.find(x => x.id === id); if (!rec) return;

  if (btn.dataset.a === "copy") {
    copy(personalize(rec.answer, "", me.name), "התשובה הועתקה");
    return;
  }
  const area = card.querySelector(".editArea");
  if (area.innerHTML) { area.innerHTML = ""; return; }
  area.innerHTML = `
    <label class="lbl" style="margin-top:12px">השאלה המרכזית</label>
    <input type="text" class="eq" value="${esc(rec.question)}"/>
    <label class="lbl" style="margin-top:10px">ניסוחים חלופיים (מופרדים בפסיק)</label>
    <input type="text" class="ea" value="${esc(rec.alt.split(";").map(x => x.trim()).filter(Boolean).join(", "))}"/>
    <label class="lbl" style="margin-top:10px">התשובה</label>
    <textarea class="eb" style="min-height:140px">${esc(rec.answer)}</textarea>
    <label class="lbl" style="margin-top:10px">קטגוריה</label>
    <input type="text" class="ec" value="${esc(rec.category)}"/>
    <label class="lbl" style="margin-top:10px">סוג לקוחה</label>
    <div class="chips ect">${["לקוחה קיימת", "עדיין לא לקוחה", "שתיהן"].map(o =>
      `<button class="chip ${rec.customerType.includes(o) ? "on" : ""}" data-v="${o}">${o}</button>`).join("")}</div>
    <label class="lbl" style="margin-top:10px">סטטוס</label>
    <div class="chips est">${["מאושר", "טיוטה", "לא לפרסם"].map(o =>
      `<button class="chip ${rec.status === o ? "on" : ""}" data-v="${o}">${o}</button>`).join("")}</div>
    <div class="acts" style="margin-top:14px">
      <button class="btn" data-a="approve">שמירה ואישור</button>
      <button class="btn soft" data-a="save">שמירה בלבד</button>
    </div>`;
  area.querySelector(".ect").addEventListener("click", ev => {
    const b = ev.target.closest("button"); if (b) b.classList.toggle("on");
  });
  area.querySelector(".est").addEventListener("click", ev => {
    const b = ev.target.closest("button"); if (!b) return;
    [...ev.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
  });

  const doSave = async (forceApprove) => {
    const chosen = area.querySelector(".est .on")?.dataset.v || rec.status;
    const payload = {
      action: "update", id,
      question: area.querySelector(".eq").value.trim(),
      alt: area.querySelector(".ea").value.split(",").map(x => x.trim()).filter(Boolean).join("; "),
      answer: area.querySelector(".eb").value.trim(),
      category: area.querySelector(".ec").value.trim(),
      customerType: [...area.querySelectorAll(".ect .on")].map(x => x.dataset.v).join("; "),
      status: forceApprove ? "מאושר" : chosen,
    };
    const r = await api("/api/records", payload);
    if (r.error) return toast("שגיאה: " + r.error);
    Object.assign(rec, {
      question: payload.question, alt: payload.alt, answer: payload.answer,
      category: payload.category, customerType: payload.customerType, status: payload.status,
    });
    toast(payload.status === "מאושר" ? "נשמר ואושר · עלה לאוויר" : "נשמר · " + payload.status);
    drawBrowse();
  };
  area.querySelector('[data-a="approve"]').onclick = () => doSave(true);
  area.querySelector('[data-a="save"]').onclick = () => doSave(false);
});

// ---------- פוש: רישום המכשיר לקבלת התראות ----------
async function setupPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    if (Notification.permission === "denied") return;
    if (Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      if (p !== "granted") return;
    }
    const { key } = await fetch("/api/subscribe").then(r => r.json());
    if (!key) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await api("/api/subscribe", { subscription: sub.toJSON() });
    } else if (!localStorage.getItem("myprime_push_saved")) {
      await api("/api/subscribe", { subscription: sub.toJSON() });
    }
    localStorage.setItem("myprime_push_saved", "1");
  } catch { /* פוש לא זמין במכשיר הזה */ }
}
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/** פתיחת תשובה ישירות מלחיצה על התראה במכשיר */
async function openFromUrl() {
  const ref = new URLSearchParams(location.search).get("ref");
  if (!ref) return;
  history.replaceState({}, "", "/");
  const r = await api("/api/record", { id: ref });
  if (r.error) return;
  lastMsg = r.question || "";
  renderAssist({ mode: "answer", id: r.id, text: r.text, category: r.category, matchedQuestion: r.question });
}

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
          ${n.ref ? `<div class="acts" style="margin-top:8px"><button class="btn soft" data-ref="${esc(n.ref)}" data-type="${esc(n.type)}" data-note="${esc(n.text)}" data-from="${esc(n.from || "")}">${n.type === "השגה" ? "בדיקת ההשגה" : "צפייה בתשובה"}</button></div>` : ""}
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
  showSection("Assist");
  lastMsg = r.question || "";
  if (b.dataset.type === "השגה") renderObjection(r, b.dataset.note || "", b.dataset.from || "");
  else renderAssist({ mode: "answer", id: r.id, text: r.text, category: r.category, matchedQuestion: r.question });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- שחזור כניסה קודמת ----------
try {
  const saved = JSON.parse(localStorage.getItem(SKEY) || "null");
  if (saved && saved.email && saved.code) { me = saved; start(); }
} catch {}
