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
      const universal = types.some(t => t === "שתיהן" || t === "כל הסוגים");
      if (types.length && !universal && !types.includes(scope)) return false;
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
  const cat = (category || "").trim();
  if (cat) {
    const exact = list.find(r => (r["קטגוריה"] || "").trim() === cat);
    if (exact) return exact;
    // התאמה רכה: חפיפת מילים בין שמות הקטגוריות
    const cw = new Set(words(cat));
    let best = null, bestScore = 0;
    for (const r of list) {
      const rw = new Set(words(r["קטגוריה"] || ""));
      let inter = 0; cw.forEach(w => { if (rw.has(w)) inter++; });
      const score = cw.size ? inter / cw.size : 0;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    if (best && bestScore >= 0.5) return best;
  }
  return null;
}

// ---------- הודעות יזומות ----------
/** הודעות יזומות מאושרות בלבד */
export function proactivePool(records) {
  return records.filter(r => r["סטטוס"] === "מאושר" && (r["סוג"] || "").trim() === "הודעה יזומה");
}

/** כל השדות שאפשר להתאים אליהם בהודעה יזומה: המצב, השאלה והניסוחים */
function proactiveTexts(r) {
  return [r["מתי לשלוח (טריגר)"], r["שאלה מרכזית"], ...(r["ניסוחים חלופיים"] || "").split(";")]
    .filter(t => t && t.trim());
}

/** התאמה מדויקת להודעה יזומה */
export function proactiveExact(records, query) {
  const q = norm(query);
  return proactivePool(records).find(r => proactiveTexts(r).some(t => norm(t) === q)) || null;
}

/** התאמה קרובה להודעה יזומה, לפי חפיפת מילים. מחזיר מערך מדורג. */
export function proactiveSearch(records, query, limit = 5) {
  const qw = new Set(words(query));
  if (!qw.size) return [];
  const scored = [];
  for (const r of proactivePool(records)) {
    let best = 0;
    for (const t of proactiveTexts(r)) {
      const tw = new Set(words(t));
      if (!tw.size) continue;
      let inter = 0; qw.forEach(w => { if (tw.has(w)) inter++; });
      const score = (2 * inter) / (qw.size + tw.size);
      if (score > best) best = score;
    }
    if (best > 0.18) scored.push({ rec: r, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------- סינון מוקדם, בלי טוקנים ----------
/**
 * בדיקה זולה שרצה לפני המנוע. מחזירה סיבה אם ברור שאין כאן פנייה אמיתית,
 * או null אם צריך להמשיך לבדיקה רגילה. שמרנית בכוונה, כדי לא לחסום פניות אמיתיות.
 */
export function junkCheck(text) {
  const t = (text || "").trim();
  if (!t) return "ההודעה ריקה.";

  // הסרת אימוג'ים וסימנים כדי לבדוק אם נשאר תוכן
  const letters = t.replace(/[^\u0590-\u05FFa-zA-Z]/g, "");
  if (letters.length < 3) return "ההודעה אינה מכילה טקסט לענות עליו.";

  // קישור בלבד
  if (/^\s*(https?:\/\/|www\.)\S+\s*$/i.test(t)) return "ההודעה מכילה קישור בלבד.";

  // רצף אותיות לטיניות בלי תנועות סבירות, כמו הקלדה אקראית
  const oneWord = t.split(/\s+/).filter(Boolean).length === 1;
  if (oneWord && /^[a-zA-Z]{7,}$/.test(t)) {
    const vowels = (t.match(/[aeiouAEIOU]/g) || []).length;
    if (vowels / t.length < 0.25) return "ההודעה אינה נראית כטקסט קריא.";
  }
  return null;
}

