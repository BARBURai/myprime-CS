// ============================================================
// app.js — בלוק בקרת המסך
// מחבר את הבלוקים למסך: טוען נתונים חיים מהגיליון, מפעיל חיפוש,
// מצייר את מצבי התוצאה, ואוסף הערות. דק בכוונה - הלוגיקה
// יושבת בבלוקים תחת lib/.
// ============================================================

import { fetchRecords } from "./lib/sheet.js";
import { findAnswer } from "./lib/engine.js";
import { personalize } from "./lib/wrap.js";

let RECORDS = [];
let scope = "all", topic = "all";
let notes = [];

const $ = id => document.getElementById(id);
const esc = s => (s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// סינון לפי סוג לקוחה. תשובות ללא סימון מוצגות בכל הסינונים.
function inScope(r) {
  if (scope === "all") return true;
  const v = scope === "exist" ? "לקוחה קיימת" : "עדיין לא לקוחה";
  return r.customerTypes.length === 0 ||
    r.customerTypes.includes(v) ||
    r.customerTypes.includes("שתיהן");
}

// ---------- טעינת הנתונים החיים ----------
async function load() {
  try {
    RECORDS = await fetchRecords();
    $("sub").textContent = `מחובר לגיליון · ${RECORDS.length} תשובות מאושרות`;
    buildTopics();
    $("result").innerHTML = `<div class="empty">הקלידי שאלה כדי למצוא תשובה מאושרת.</div>`;
    $("q").disabled = false; $("go").disabled = false;
  } catch (e) {
    $("result").innerHTML = `<div class="panel"><span class="badge warn">שגיאה בטעינה</span>
      <div class="answer" style="color:var(--muted)">לא הצלחתי לקרוא מהגיליון. ודאו שהגיליון משותף כ"כל מי שיש לו הקישור - צופה", ושהמזהה ב-lib/config.js נכון.</div></div>`;
  }
}

function buildTopics() {
  const cats = Array.from(new Set(RECORDS.map(r => r.cat).filter(Boolean))).sort();
  $("topic").innerHTML = `<button class="chip topic on" data-v="all">הכול</button>` +
    cats.map(c => `<button class="chip topic" data-v="${esc(c)}">${esc(c)}</button>`).join("");
}

// ---------- תצוגת התוצאה ----------
function render(query) {
  const pool = RECORDS.filter(inScope);
  const res = findAnswer(pool, query);
  if (res.rec && topic !== "all" && res.rec.cat !== topic) { res.stage = "none"; res.rec = null; }
  const box = $("result");

  if (res.stage === "none") {
    box.innerHTML = `<div class="panel">
      <span class="badge none">אין תשובה מאושרת</span>
      <div class="answer" style="color:var(--muted)">אין עדיין תשובה מאושרת לשאלה הזו. אל תנסחי תשובה בעצמך. כתבי כאן מה לדעתך התשובה צריכה להיות, וזה יגיע ל‑Ron.</div>
      <textarea id="fnote" placeholder="מה התשובה צריכה להיות / הערה ל‑Ron…"></textarea>
      <div class="acts" style="margin-top:10px"><button class="btn ghost" id="addNote">הוספה להערות ל‑Ron</button></div>
    </div>`;
    $("addNote").onclick = () => addNote(query, "אין תשובה", $("fnote").value.trim());
    return;
  }

  const r = res.rec;
  const body = personalize(r.a, $("cname").value, $("responder").value);
  const close = res.stage === "close";
  box.innerHTML = `<div class="panel">
    <span class="badge ${close ? "warn" : "ok"}">${close ? "התאמה קרובה" : "תשובה מאושרת"}</span>
    ${close ? `<div class="warnbox">התאמה אוטומטית לשאלה «${esc(r.q)}». כדאי לוודא שהתשובה מתאימה לפני שליחה.</div>` : ""}
    <div class="answer">${esc(body)}</div>
    <div class="acts">
      <button class="btn" id="copy">העתקת התשובה</button>
      <button class="btn soft" id="noteToggle">הוספת הערה</button>
      <span class="meta">· ${esc(r.cat)}${r.health ? " · בריאותי" : ""}</span>
    </div>
    <div id="noteArea"></div>
  </div>`;
  $("copy").onclick = () => copy(body);
  $("noteToggle").onclick = () => {
    const a = $("noteArea");
    if (a.innerHTML) { a.innerHTML = ""; return; }
    a.innerHTML = `<textarea id="fnote2" placeholder="הערה ל‑Ron על התשובה הזו…" style="margin-top:10px"></textarea>
      <div class="acts" style="margin-top:8px"><button class="btn ghost" id="addNote2">הוספה להערות</button></div>`;
    $("addNote2").onclick = () => addNote(query, r.id + " · " + (close ? "התאמה קרובה" : "מאושרת"), $("fnote2").value.trim());
  };
}

// ---------- הערות (האינפוטים של הצוות) ----------
function addNote(query, tag, text) {
  if (!text) { toast("כתבי הערה קודם"); return; }
  notes.push({ query, tag, text, scope, topic });
  drawNotes(); toast("נוסף להערות ל‑Ron");
}
function drawNotes() {
  $("ncount").textContent = notes.length;
  $("notes").innerHTML = notes.map((n, i) => `<div class="note">
    <div class="q">${i + 1}. «${esc(n.query)}» <span class="meta">· ${esc(n.tag)}</span></div>
    <div class="n">${esc(n.text)}</div></div>`).join("");
}
$("copyNotes").onclick = () => {
  if (!notes.length) { toast("אין עדיין הערות"); return; }
  const sName = { all: "הכול", exist: "לקוחה קיימת", new: "עדיין לא לקוחה" };
  const txt = "הערות · MyPrime\n=====================\n\n" + notes.map((n, i) =>
    `${i + 1}. חיפוש: "${n.query}"\n   הקשר: ${sName[n.scope]} · נושא: ${n.topic}\n   ${n.tag}\n   הערה: ${n.text}`).join("\n\n");
  copy(txt, "כל ההערות הועתקו — אפשר לשלוח ל‑Ron");
};

// ---------- כלים ----------
function copy(text, msg) {
  navigator.clipboard.writeText(text).then(() => toast(msg || "התשובה הועתקה"), () => {
    const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand("copy"); t.remove(); toast(msg || "התשובה הועתקה");
  });
}
let tt;
function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 1900); }

// ---------- חיווט אירועים ----------
$("scope").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  scope = b.dataset.v; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
});
$("topic").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  topic = b.dataset.v; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
});
$("go").onclick = () => { const q = $("q").value.trim(); if (q) render(q); };
$("q").addEventListener("keydown", e => { if (e.key === "Enter") { const q = e.target.value.trim(); if (q) render(q); } });

load();
