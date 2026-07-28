// ============================================================
// engine.js — בלוק מנוע התשובות
// ארבעת שלבי מציאת התשובה. שלב 3 (התאמה קרובה) עובד כרגע
// בהתאמת מילים מקומית. כשיתחבר שרת, נחליף אותו בקריאת Haiku
// בלי לגעת בשאר הקוד.
// ============================================================

import { CLOSE_MATCH_THRESHOLD } from "./config.js";

const norm = s => (s || "").toLowerCase()
  .replace(/[?!.,:;"'`\u05f3\u05f4]/g, " ").replace(/\s+/g, " ").trim();
const toks = s => norm(s).split(" ").filter(Boolean);

/** מחזיר { stage, rec } לפי ארבעת השלבים. */
export function findAnswer(records, query) {
  const q = norm(query);

  // שלב 1 - התאמה ישירה
  let hit = records.find(r => norm(r.q) === q);
  if (hit) return { stage: "direct", rec: hit };

  // שלב 2 - ניסוחים חלופיים
  hit = records.find(r => r.alt.some(p => norm(p) === q));
  if (hit) return { stage: "alt", rec: hit };

  // שלב 3 - התאמה קרובה (חופף מילים; מדמה את שכבת ה-AI)
  const qt = toks(query);
  let best = null, score = 0;
  for (const r of records) {
    const hay = new Set(toks(r.q + " " + r.alt.join(" ")));
    let m = 0; qt.forEach(t => { if (hay.has(t)) m++; });
    const s = qt.length ? m / qt.length : 0;
    if (s > score) { score = s; best = r; }
  }
  if (best && score >= CLOSE_MATCH_THRESHOLD) return { stage: "close", rec: best };

  // שלב 4 - אין התאמה בטוחה
  return { stage: "none", rec: null };
}
