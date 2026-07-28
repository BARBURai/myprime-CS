// ============================================================
// engine.js — בלוק ההתאמה המדויקת (חינם, בלי AI)
// השלב הראשון תמיד. אם השאלה מוכרת ויש לה תשובה אחת ברורה,
// מחזירים אותה מיד בלי להפעיל את המנוע החושב ובלי טוקנים.
// ============================================================

const norm = s => (s || "").toLowerCase()
  .replace(/[?!.,:;"'`\u05f3\u05f4]/g, " ").replace(/\s+/g, " ").trim();

/** מסנן רשומות מאושרות מסוג מענה, בתחום סוג הלקוחה שנבחר. */
export function pool(records, scope) {
  return records.filter(r => {
    if (r["סטטוס"] !== "מאושר") return false;
    const kind = r["סוג"]; if (kind && kind !== "מענה") return false;
    if (scope && scope !== "all") {
      const types = (r["סוג לקוחה"] || "").split(";").map(s => s.trim());
      if (types.filter(Boolean).length &&
        !types.includes(scope) && !types.includes("שתיהן")) return false;
    }
    return true;
  });
}

/** התאמה מדויקת לשאלה מרכזית או לניסוח חלופי. מחזיר רשומה או null. */
export function exactMatch(records, query, scope) {
  const q = norm(query);
  const list = pool(records, scope);
  return list.find(r => norm(r["שאלה מרכזית"]) === q) ||
    list.find(r => (r["ניסוחים חלופיים"] || "").split(";").some(p => norm(p) === q)) ||
    null;
}

/** גוף התשובה: התיקון של Ron אם קיים, אחרת התשובה המקורית. */
export function bodyOf(r) {
  return (r["נוסח סופי / תיקון"] || "").trim() || (r["תשובה (קול ענת)"] || "").trim();
}
