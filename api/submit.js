// ============================================================
// api/submit.js — שליחה לאישור Ron
// kind "new": תשובה חדשה שהעוזר ניסח -> שורה חדשה בסטטוס
//   "ממתין לאישור" + התראה ל-Ron.
// kind "objection": השגה על תשובה קיימת -> התראה ל-Ron עם ההערה
//   וההצעה, בלי לשנות את הרשומה החיה.
// ============================================================

import { appendRow, nextId, addNotification, readAll } from "../lib/sheets.js";
import { requireUser, adminNames } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const b = await readBody(req);
    const me = await requireUser(b);
    const by = me.name;

    if (b.kind === "objection") {
      const admins = await adminNames();
      for (const a of admins) {
        await addNotification({
          to: a, type: "השגה",
          text: `${by} מעירה על ${b.refId}: ${b.note || ""}${b.draft ? "\nהצעה: " + b.draft : ""}`,
          from: by,
          ref: b.refId || "",
        });
      }
      return send(res, 200, { ok: true });
    }

    // התאמה של נציגה: נשמרת לסקירה, לא מופיעה בחיפוש ולא נשלחת לאיש
    if (b.kind === "adaptation") {
      const { records } = await readAll();
      const src = records.find(r => r["מזהה"] === b.sourceId) || {};
      const id = await nextId();
      await appendRow({
        "מזהה": id,
        "שאלה מרכזית": b.question || "",
        "ניסוחים חלופיים": "",
        "תשובה (קול ענת)": b.draft || "",
        "קטגוריה": src["קטגוריה"] || "",
        "סוג לקוחה": src["סוג לקוחה"] || "",
        "מקור": by,
        "בריאותי": src["בריאותי"] || "",
        "סטטוס": "התאמת תשובות",
        "סוג": "מענה",
        "הערה לצוות": `התאמה של ${by} לרשומה ${b.sourceId || ""}`,
      });
      return send(res, 200, { ok: true, id });
    }

    // הוספה ישירה של מנהל: נכנס מיד כמאושר
    if (b.kind === "direct") {
      if (me.role !== "מנהל") return send(res, 403, { error: "אין הרשאה" });
      const id = await nextId();
      await appendRow({
        "מזהה": id,
        "שאלה מרכזית": b.question || "",
        "ניסוחים חלופיים": (b.altPhrasings || []).join("; "),
        "תשובה (קול ענת)": b.draft || "",
        "קטגוריה": b.fields?.category || "",
        "סוג לקוחה": (b.fields?.customerTypes || []).join("; "),
        "מקור": by,
        "בריאותי": b.fields?.health ? "כן" : "",
        "סטטוס": "מאושר",
        "סוג": b.fields?.kind || "מענה",
        "מתי לשלוח (טריגר)": b.fields?.trigger || "",
        "נוסח כללי": b.fields?.general ? "כן" : "",
        "הערה לצוות": b.note || "",
      });
      return send(res, 200, { ok: true, id });
    }

    // תשובה חדשה
    const id = await nextId();
    await appendRow({
      "מזהה": id,
      "שאלה מרכזית": b.question || "",
      "ניסוחים חלופיים": (b.altPhrasings || []).join("; "),
      "תשובה (קול ענת)": b.draft || "",
      "קטגוריה": b.fields?.category || "",
      "סוג לקוחה": (b.fields?.customerTypes || []).join("; "),
      "מקור": by,
      "בריאותי": b.fields?.health ? "כן" : "",
      "סטטוס": "ממתין לאישור",
      "סוג": b.fields?.kind || "מענה",
      "מתי לשלוח (טריגר)": b.fields?.trigger || "",
      "נוסח כללי": b.fields?.general ? "כן" : "",
      "הערה לצוות": b.note || "",
    });
    for (const a of await adminNames()) {
      await addNotification({ to: a, type: "תשובה חדשה", text: `${by} שלחה לאישור: ${b.question || id}`, ref: id });
    }
    return send(res, 200, { ok: true, id });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
