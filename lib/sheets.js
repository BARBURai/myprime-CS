// ============================================================
// sheets.js — בלוק הגיליון (צד שרת)
// קריאה וכתיבה למאגר דרך חשבון שירות של גוגל.
// גרסה מחוזקת: מתמודדת עם מפתח שהודבק עם רווחים, מרכאות עוטפות,
// תוכן עודף אחרי סוף הקובץ, או שורות שבורות במפתח ההצפנה.
// ============================================================

import { google } from "googleapis";
import { SHEET_ID, TAB_MAIN, TAB_NOTES } from "./config.js";

/** קורא את פרטי חשבון השירות ממשתנה הסביבה, בסובלנות לתקלות הדבקה. */
function credentials() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT || "";

  raw = raw.trim();

  // תמיכה גם במפתח שהודבק מקודד ב-base64
  if (raw && !raw.startsWith("{")) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) raw = decoded;
    } catch { /* ממשיכים */ }
  }

  // הסרת מרכאות עוטפות אם מישהו הדביק את הכל בתוך מרכאות
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }

  // חיתוך כל תוכן שנדבק אחרי סוף האובייקט
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);

  if (!raw) throw new Error("חסר משתנה הסביבה GOOGLE_SERVICE_ACCOUNT");

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error("קובץ חשבון השירות אינו תקין. יש להדביק מחדש את כל תוכן קובץ ה-JSON, בלי רווחים לפני ואחרי.");
  }

  if (!creds.client_email || !creds.private_key) {
    throw new Error("בקובץ חשבון השירות חסר client_email או private_key");
  }

  // תיקון שורות במפתח ההצפנה (מקרה נפוץ בהדבקה)
  creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");

  return creds;
}

function auth() {
  const creds = credentials();
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}
const api = () => google.sheets({ version: "v4", auth: auth() });

// --- קריאה: מחזיר את כל השורות כאובייקטים ממופתחים לפי הכותרת ---
export async function readAll(tab = TAB_MAIN) {
  const res = await api().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return { header: rows[0] || [], records: [] };
  const header = rows[0].map(h => (h || "").trim());
  const records = rows.slice(1).map((r, i) => {
    const o = { _row: i + 2 }; // מספר השורה בפועל בגיליון (לעדכון)
    header.forEach((h, c) => (o[h] = (r[c] || "").trim()));
    return o;
  });
  return { header, records };
}

// --- הוספת שורה חדשה לפי מיפוי כותרת->ערך ---
export async function appendRow(map, tab = TAB_MAIN) {
  const { header } = await readAll(tab);
  const row = header.map(h => map[h] ?? "");
  await api().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tab}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

// --- עדכון שורה קיימת לפי מזהה MP, רק העמודות שנשלחו ---
export async function updateById(id, map, tab = TAB_MAIN) {
  const { header, records } = await readAll(tab);
  const rec = records.find(r => r["מזהה"] === id);
  if (!rec) throw new Error("record-not-found");
  const data = Object.entries(map).map(([h, v]) => {
    const col = header.indexOf(h);
    if (col < 0) return null;
    const a1 = String.fromCharCode(65 + col); // A..Z
    return { range: `${tab}!${a1}${rec._row}`, values: [[v]] };
  }).filter(Boolean);
  await api().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: "RAW", data },
  });
}

// --- מזהה MP הבא ---
export async function nextId() {
  const { records } = await readAll(TAB_MAIN);
  const nums = records
    .map(r => parseInt((r["מזהה"] || "").replace("MP-", ""), 10))
    .filter(n => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return "MP-" + String(n).padStart(3, "0");
}

// --- התראות ---
export async function addNotification({ to, type, text, ref }) {
  await appendRow({
    "מתי": new Date().toISOString(),
    "אל": to, "סוג": type, "טקסט": text, "הפניה": ref || "", "נקרא": "",
  }, TAB_NOTES);
}
export async function listNotifications(to) {
  try {
    const { records } = await readAll(TAB_NOTES);
    return records.filter(r => (r["אל"] === to || r["אל"] === "all"));
  } catch { return []; }
}
