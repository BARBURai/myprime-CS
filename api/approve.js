// ============================================================
// api/approve.js — תור האישורים של Ron וכתיבה חזרה למאגר
// GET  ?list=pending  -> הפריטים הממתינים לאישור
// POST {action:"approve", id, finalText?, by} -> מאשר + מתריע לטלי
// POST {action:"return",  id, note, by}       -> מחזיר לטיפול + מתריע
// ============================================================

import { readAll, updateById, addNotification } from "../lib/sheets.js";
import { requireUser, isAdmin } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const b0 = await readBody(req);
    const me = await requireUser(b0);
    if (!isAdmin(me)) return send(res, 403, { error: "אין הרשאה" });

    if (b0.action === "list") {
      const { records } = await readAll();
      const pending = records.filter(r => r["סטטוס"] === "ממתין לאישור").map(r => ({
        id: r["מזהה"], question: r["שאלה מרכזית"],
        text: (r["נוסח סופי / תיקון"] || r["תשובה (קול ענת)"] || ""),
        category: r["קטגוריה"], customerType: r["סוג לקוחה"],
        health: r["בריאותי"] === "כן", source: r["מקור"],
      }));
      return send(res, 200, { pending });
    }

    const b = b0;
    const to = b.to || "טלי"; // מי לעדכן (מקור הרשומה)

    if (b.action === "approve") {
      const map = { "סטטוס": "מאושר" };
      if (b.finalText) map["נוסח סופי / תיקון"] = b.finalText; // תיקון של Ron גובר
      await updateById(b.id, map);
      await addNotification({ to, type: "אושר", text: `אושר ועלה לאוויר: ${b.id}`, ref: b.id });
      return send(res, 200, { ok: true });
    }

    if (b.action === "return") {
      await updateById(b.id, { "סטטוס": "הוחזר לטיפול" });
      await addNotification({ to, type: "הוחזר", text: `הוחזר לטיפול: ${b.id}. ${b.note || ""}`, ref: b.id });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: "bad-action" });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
