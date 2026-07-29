// ============================================================
// engine.js — בלוק ההתאמה (בלי AI, בלי טוקנים)
// שלב 1: התאמה מדויקת. שלב 2: התאמה קרובה לפי חפיפת מילים.
// רק אם שניהם נכשלים מפעילים את המנוע החושב.
// ============================================================

const STOP = new Set(["של","את","אני","לי","זה","זאת","הוא","היא","גם","כל","אם","או","אבל","כי","עם","על","לא","יש","אין","מה","איך","כמה","הכי","רק","עוד","כבר","הרבה","מאוד","להיות","יכולה","רוצה","צריך","צריכה"]);

const norm = s => (s || "").toLowerCase()
  .replace(/[?!.,:;"'`\u05f3\u05f4()\[\]־–-]/g, " ").replace(/\s+/g, " ").trim();

const words = s => norm(s).split(" ").filter(w => w.length > 2 && !STOP.has(w));

export const isGeneral = r => (r["נוסח כללי"] || "").trim() === "כן";

/** מסנן רשומות מאושרות מסוג מענה, בתחום סוג הלקוחה שנבחר.
 *  נוסחים כלליים מוחרגים: הם משמשים רק כגיבוי, לא בחיפוש רגיל. */
export function pool(records, scope) {
  return records.filter(r => {
    if (r["סטטוס"] !== "מאושר") return false;
    if (isGeneral(r)) return false;
    const kind = r["סוג"]; if (kind && kind !== "מענה") return false;
    if (scope && scope !== "all") {
      const types = (r["סוג לקוחה"] || "").split(";").map(s => s.trim()).filter(Boolean);
      if (types.length && !types.includes(scope) && !types.includes("שתיהן")) return false;
    }
    return true;
  });
}

/** שלב 1: התאמה מדויקת לשאלה מרכזית או לניסוח חלופי. */
export function exactMatch(records, query, scope) {
  const q = norm(query);
  const list = pool(records, scope);
  return list.find(r => norm(r["שאלה מרכזית"]) === q) ||
    list.find(r => (r["ניסוחים חלופיים"] || "").split(";").some(p => p.trim() && norm(p) === q)) ||
    null;
}

/**
 * שלב 2: התאמה קרובה לפי חפיפת מילים (מדד דייס).
 * מחזיר { rec, score } או null. מיועד לתפוס ניסוח דומה בלי להפעיל AI.
 */
export function fuzzyMatch(records, query, scope, threshold = 0.62) {
  const qw = new Set(words(query));
  if (!qw.size) return null;
  let best = null, bestScore = 0;

  for (const r of pool(records, scope)) {
    const texts = [r["שאלה מרכזית"], ...(r["ניסוחים חלופיים"] || "").split(";")];
    for (const t of texts) {
      if (!t || !t.trim()) continue;
      const tw = new Set(words(t));
      if (!tw.size) continue;
      let inter = 0; qw.forEach(w => { if (tw.has(w)) inter++; });
      const score = (2 * inter) / (qw.size + tw.size);
      if (score > bestScore) { bestScore = score; best = r; }
    }
  }
  return bestScore >= threshold ? { rec: best, score: bestScore } : null;
}

/** גוף התשובה: התיקון של Ron אם קיים, אחרת התשובה המקורית. */
export function bodyOf(r) {
  return (r["נוסח סופי / תיקון"] || "").trim() || (r["תשובה (קול ענת)"] || "").trim();
}

/** מאתר נוסח כללי מאושר לקטגוריה מסוימת. משמש כשאין תשובה מדויקת. */
export function generalFor(records, category) {
  const list = records.filter(r => r["סטטוס"] === "מאושר" && isGeneral(r));
  if (!list.length) return null;
  const exact = category && list.find(r => (r["קטגוריה"] || "").trim() === category.trim());
  return exact || null;
}
