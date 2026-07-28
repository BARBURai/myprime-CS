// ============================================================
// users.js — בלוק המשתמשים וההרשאות
// המשתמשים יושבים בלשונית "משתמשים" בגיליון, עם העמודות:
// שם | מייל | קוד | תפקיד | פעיל
// תפקיד: מנהל / מנהלת שירות / נציג
// פעיל: כן / ריק (ריק או "לא" = חסום)
// ============================================================

import { readAll, appendRow, updateById } from "./sheets.js";
import { google } from "googleapis";
import { SHEET_ID, TAB_USERS } from "./config.js";

const norm = s => (s || "").toString().trim().toLowerCase();

/** כל המשתמשים מהגיליון. */
export async function allUsers() {
  const { records } = await readAll(TAB_USERS);
  return records.map(r => ({
    row: r._row,
    name: r["שם"] || "",
    email: r["מייל"] || "",
    code: r["קוד"] || "",
    role: r["תפקיד"] || "נציג",
    active: (r["פעיל"] || "").trim() !== "לא" && (r["פעיל"] || "").trim() !== "",
  }));
}

/** אימות מייל וקוד. מחזיר את המשתמש או null. */
export async function verify(email, code) {
  const users = await allUsers();
  const u = users.find(u => norm(u.email) === norm(email) && u.code.trim() === (code || "").trim());
  if (!u || !u.active) return null;
  return { name: u.name, email: u.email, role: u.role };
}

export const isAdmin = user => user && user.role === "מנהל";
export const canPrepare = user => user && (user.role === "מנהל" || user.role === "מנהלת שירות");

/** אימות מתוך גוף הבקשה. זורק שגיאה אם לא מורשה. */
export async function requireUser(body) {
  const u = await verify(body?.auth?.email, body?.auth?.code);
  if (!u) throw new Error("unauthorized");
  return u;
}

// ---------- ניהול (למנהל בלבד) ----------

export async function addUser({ name, email, code, role }) {
  await appendRow({ "שם": name, "מייל": email, "קוד": code, "תפקיד": role || "נציג", "פעיל": "כן" }, TAB_USERS);
}

/** עדכון שורה בלשונית המשתמשים לפי מספר שורה. */
export async function updateUserRow(row, map) {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || "{}");
  creds.private_key = String(creds.private_key || "").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: creds.client_email, key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const api = google.sheets({ version: "v4", auth });
  const { header } = await readAll(TAB_USERS);
  const data = Object.entries(map).map(([h, v]) => {
    const col = header.indexOf(h);
    if (col < 0) return null;
    return { range: `${TAB_USERS}!${String.fromCharCode(65 + col)}${row}`, values: [[v]] };
  }).filter(Boolean);
  await api.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: "RAW", data },
  });
}

/** קוד אקראי בן שש ספרות. */
export function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
