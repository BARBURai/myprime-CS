// ============================================================
// approve.js — בקרת מסך האישורים של Ron
// ============================================================
const $ = id => document.getElementById(id);
const esc = s => (s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
let queue = [], i = 0;

async function load() {
  try {
    const r = await fetch("/api/approve?list=pending").then(r => r.json());
    queue = r.pending || []; i = 0;
    $("sub").textContent = `${queue.length} ממתינים לאישור`;
    draw();
  } catch (e) {
    $("queue").innerHTML = `<div class="panel"><span class="badge warn">שגיאה בטעינה</span></div>`;
  }
}

function draw() {
  if (i >= queue.length) { $("queue").innerHTML = `<div class="empty">אין פריטים לאישור. סיימת 🌷</div>`; $("sub").textContent = "0 ממתינים"; return; }
  const it = queue[i];
  $("sub").textContent = `${i + 1} מתוך ${queue.length}`;
  $("queue").innerHTML = `<div class="panel">
    <div class="acts" style="margin-bottom:8px">
      <span class="badge warn">ממתין לאישור</span>
      <span class="meta">· ${esc(it.category || "")} · ${esc(it.customerType || "")} · הכינה: ${esc(it.source || "")}</span>
    </div>
    <div class="lbl">השאלה</div>
    <div style="font-size:16px;font-weight:500;margin-bottom:12px">${esc(it.question || "")}</div>
    <div class="lbl">התשובה (אפשר לערוך)</div>
    <textarea id="ft" style="min-height:150px">${esc(it.text || "")}</textarea>
    <div class="row" style="margin-top:14px">
      <button class="btn" id="ok">אישור · יעלה לאוויר</button>
      <button class="btn soft" id="ret">החזרה לטלי</button>
    </div>
  </div>`;
  $("ok").onclick = () => act("approve", { finalText: $("ft").value.trim() });
  $("ret").onclick = () => {
    const note = prompt("הערה לטלי (לא חובה):") || "";
    act("return", { note });
  };
}

function act(action, extra) {
  const it = queue[i];
  fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id: it.id, by: "Ron", ...extra }) })
    .then(r => r.json()).then(() => { toast(action === "approve" ? "אושר ועלה לאוויר" : "הוחזר לטלי"); i++; draw(); })
    .catch(() => toast("שגיאה"));
}

let tt; function toast(m) { const e = $("toast"); e.textContent = m; e.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("show"), 1900); }

$("bell").onclick = () => { const n = $("notifs"); n.style.display = n.style.display === "none" ? "block" : "none"; };
async function poll() {
  try {
    const r = await fetch("/api/notifications?to=Ron").then(r => r.json());
    const items = r.items || [];
    $("bc").textContent = items.length; $("bc").style.display = items.length ? "inline" : "none";
    $("notifs").innerHTML = items.length ? items.map(n => `<div class="notif"><b>${esc(n.type)}</b><div class="t">${esc(n.text)}</div></div>`).join("") : `<div class="empty">אין התראות</div>`;
  } catch {}
}
load(); poll(); setInterval(poll, 20000);
