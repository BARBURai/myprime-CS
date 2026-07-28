// ============================================================
// sheet.js — בלוק הנתונים
// קורא את הגיליון החי דרך הקישור המשותף (בלי CSV ובלי מפתח),
// ומחזיר רק את הרשומות המאושרות מסוג "מענה".
// הגיליון צריך להיות משותף כ"כל מי שיש לו הקישור - צופה".
// ============================================================

import { SHEET_ID, SHEET_TAB } from "./config.js";

// שירות שממיר גיליון משותף ל-JSON לפי מזהה ושם לשונית, בלי מפתח.
const ENDPOINT = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(SHEET_TAB)}`;

const g = (row, name) => (row[name] ?? "").toString().trim();
const list = s => s.split(";").map(x => x.trim()).filter(Boolean);

/** קורא את הגיליון ומחזיר מערך רשומות מאושרות מסוג מענה. */
export async function fetchRecords() {
  const res = await fetch(ENDPOINT, { cache: "no-store" });
  if (!res.ok) throw new Error("fetch-failed");
  const rows = await res.json(); // מערך אובייקטים, מפתח = שם העמודה

  const out = [];
  for (const row of rows) {
    if (!/^MP-\d{3}/.test(g(row, "מזהה"))) continue;
    if (g(row, "סטטוס") !== "מאושר") continue;      // רק מאושר עולה
    const kind = g(row, "סוג");
    if (kind && kind !== "מענה") continue;           // רק מענה משתתף בחיפוש
    out.push({
      id: g(row, "מזהה"),
      q: g(row, "שאלה מרכזית"),
      alt: list(g(row, "ניסוחים חלופיים")),
      a: g(row, "נוסח סופי / תיקון") || g(row, "תשובה (קול ענת)"), // תיקון גובר
      cat: g(row, "קטגוריה"),
      health: g(row, "בריאותי") === "כן",
      customerTypes: list(g(row, "סוג לקוחה")),
    });
  }
  return out;
}
