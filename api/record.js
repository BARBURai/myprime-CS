// ============================================================
// api/record.js — שליפת רשומה בודדת לפי מזהה
// משמש כדי לפתוח תשובה מתוך התראה ("אושר ועלה לאוויר: MP-204")
// ============================================================

import { readAll } from "../lib/sheets.js";
import { bodyOf } from "../lib/engine.js";
import { requireUser } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const b = await readBody(req);
    await requireUser(b);
    const { records } = await readAll();
    const r = records.find(x => x["מזהה"] === b.id);
    if (!r) return send(res, 404, { error: "לא נמצאה רשומה" });
    return send(res, 200, {
      id: r["מזהה"],
      question: r["שאלה מרכזית"],
      alt: r["ניסוחים חלופיים"] || "",
      text: bodyOf(r),
      category: r["קטגוריה"],
      customerType: r["סוג לקוחה"] || "",
      status: r["סטטוס"],
    });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
