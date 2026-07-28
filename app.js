// ============================================================
// app.js — בקרת מסך העוזר של טלי (דק; הלוגיקה בשרת)
// ============================================================
import { personalize } from "./lib/wrap.js";

const $ = id => document.getElementById(id);
const esc = s => (s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
let scope = "all", context = {}, lastMsg = "";

$("scope").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  scope = b.dataset.v;
  [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
  if (scope !== "all") context.customerType = scope;
});

$("go").onclick = () => run(true);
function run(fresh) {
  const msg = fresh ? $("msg").value.trim() : lastMsg;
  if (!msg) return;
  if (fresh) { context = scope !== "all" ? { customerType: scope } : {}; lastMsg = msg; }
  $("result").innerHTML = `<div class="spin">חושב…</div>`;
  fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg, scope, context }) })
    .then(r => r.json()).then(render)
    .catch(() => $("result").innerHTML = `<div class="panel"><span class="badge warn">שגיאה</span></div>`);
}

function render(res) {
  const box = $("result");
  if (res.error) { box.innerHTML = `<div class="panel"><span class="badge warn">שגיאה: ${esc(res.error)}</span></div>`; return; }

  // --- שאלות הבהרה בכפתורים ---
  if (res.mode === "ask") {
    box.innerHTML = `<div class="panel"><div class="lbl">כדי לדייק, כמה דברים קצרים:</div>
      ${res.questions.map((q, qi) => `<div style="margin-top:12px"><div style="font-size:14px;margin-bottom:4px">${esc(q.q)}</div>
        ${q.options.map(o => `<button class="qbtn" data-k="${esc(q.key)}" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`).join("")}
    </div>`;
    box.querySelectorAll(".qbtn").forEach(btn => btn.onclick = () => {
      context[btn.dataset.k] = btn.dataset.v; run(false);
    });
    return;
  }

  // --- תשובה מאושרת קיימת ---
  if (res.mode === "answer") {
    const body = personalize(res.text, $("cname").value, $("responder").value);
    box.innerHTML = `<div class="panel">
      <span class="badge ok">תשובה מאושרת</span>
      <div class="answer">${esc(body)}</div>
      <div class="acts">
        <button class="btn" id="copy">העתקת התשובה</button>
        <button class="btn soft" id="obj">יש לי השגה</button>
        <span class="meta">· ${esc(res.category || "")}</span>
      </div>
      <div id="objArea"></div></div>`;
    $("copy").onclick = () => copy(body);
    $("obj").onclick = () => {
      const a = $("objArea"); if (a.innerHTML) { a.innerHTML = ""; return; }
      a.innerHTML = `<textarea id="objNote" placeholder="מה לא מדויק / הצעת שיפור…" style="margin-top:10px"></textarea>
        <div class="acts" style="margin-top:8px"><button class="btn ghost" id="objSend">שליחה ל‑Ron</button></div>`;
      $("objSend").onclick = () => submit({ kind: "objection", refId: res.id, note: $("objNote").value.trim() });
    };
    return;
  }

  // --- הצעת ניסוח חדשה ---
  const f = res.fields || {};
  box.innerHTML = `<div class="panel">
    <span class="badge warn">הצעת ניסוח · לאישור Ron</span>
    <div class="lbl" style="margin-top:10px">אפשר לערוך לפני השליחה</div>
    <textarea id="draft">${esc(res.draft || "")}</textarea>
    <label class="lbl" style="margin-top:12px">קטגוריה</label>
    <input type="text" id="cat" value="${esc(f.category || "")}"/>
    <label class="lbl" style="margin-top:12px">סוג לקוחה</label>
    <div class="chips" id="ct">
      ${["לקוחה קיימת", "עדיין לא לקוחה", "שתיהן"].map(o =>
        `<button class="chip ${(f.customerTypes || []).includes(o) ? "on" : ""}" data-v="${o}">${o}</button>`).join("")}
    </div>
    <div class="acts" style="margin-top:16px">
      <button class="btn" id="send">שליחה לאישור Ron</button>
    </div></div>`;
  $("ct").addEventListener("click", e => { const b = e.target.closest("button"); if (b) b.classList.toggle("on"); });
  $("send").onclick = () => submit({
    kind: "new", question: lastMsg, draft: $("draft").value.trim(),
    fields: { category: $("cat").value.trim(),
      customerTypes: [...$("ct").querySelectorAll(".on")].map(x => x.dataset.v),
      health: false },
  });
}

function submit(payload) {
  payload.by = $("responder").value;
  fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(r => r.json()).then(() => {
      toast("נשלח ל‑Ron לאישור");
      $("result").innerHTML = `<div class="panel"><span class="badge ok">נשלח ל‑Ron</span>
        <div class="answer" style="color:var(--muted)">נעדכן אותך כאן כשזה יאושר.</div></div>`;
    }).catch(() => toast("שגיאה בשליחה"));
}

// --- העתקה + טוסט ---
function copy(t, m) { navigator.clipboard.writeText(t).then(() => toast(m || "הועתק")); }
let tt; function toast(m) { const e = $("toast"); e.textContent = m; e.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("show"), 1900); }

// --- התראות ---
$("bell").onclick = () => { const n = $("notifs"); n.style.display = n.style.display === "none" ? "block" : "none"; };
async function poll() {
  try {
    const to = $("responder").value;
    const r = await fetch(`/api/notifications?to=${encodeURIComponent(to)}`).then(r => r.json());
    const items = r.items || [];
    $("bc").textContent = items.length; $("bc").style.display = items.length ? "inline" : "none";
    $("notifs").innerHTML = items.length ? items.map(n => `<div class="notif"><b>${esc(n.type)}</b><div class="t">${esc(n.text)}</div></div>`).join("") : `<div class="empty">אין התראות</div>`;
  } catch {}
}
poll(); setInterval(poll, 20000);
