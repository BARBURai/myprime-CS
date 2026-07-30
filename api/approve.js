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
      const wanted = (Array.isArray(b0.statuses) && b0.statuses.length)
        ? b0.statuses : ["ממתין לאישור"];
      const counts = {};
      records.forEach(r => { const st = r["סטטוס"]; if (st) counts[st] = (counts[st] || 0) + 1; });
      const pending = records.filter(r => wanted.includes(r["סטטוס"])).map(r => ({
        id: r["מזהה"], question: r["שאלה מרכזית"], alt: r["ניסוחים חלופיים"] || "",
        text: (r["נוסח סופי / תיקון"] || r["תשובה (קול ענת)"] || ""),
        category: r["קטגוריה"], customerType: r["סוג לקוחה"],
        health: r["בריאותי"] === "כן", source: r["מקור"], status: r["סטטוס"],
        note: r["הערה לצוות"] || "", kind: r["סוג"] || "מענה",
        trigger: r["מתי לשלוח (טריגר)"] || "",
      }));
      return send(res, 200, { pending, counts });
    }

    const b = b0;
    const to = b.to || "טלי"; // מי לעדכן (מקור הרשומה)

    if (b.action === "approve") {
      const map = { "סטטוס": "מאושר" };
      if (b.finalText) map["נוסח סופי / תיקון"] = b.finalText;
      if (b.question) map["שאלה מרכזית"] = b.question;
      if (b.altPhrasings) map["ניסוחים חלופיים"] = b.altPhrasings;
      if (b.note !== undefined) map["הערה לצוות"] = b.note;
      if (b.trigger !== undefined) map["מתי לשלוח (טריגר)"] = b.trigger; // תיקון של Ron גובר
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
