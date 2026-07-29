// ============================================================
// api/records.js — מסך המאגר
// POST {auth, action}
//   list   -> כל הרשומות. מנהל רואה הכול, השאר רק מאושרות.
//   update -> עדכון רשומה (מנהל בלבד)
// ============================================================

import { readAll, updateById } from "../lib/sheets.js";
import { bodyOf } from "../lib/engine.js";
import { requireUser, isAdmin } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const b = await readBody(req);
    const me = await requireUser(b);

    if (b.action === "update") {
      if (!isAdmin(me)) return send(res, 403, { error: "אין הרשאה" });
      const map = {};
      if (b.question !== undefined) map["שאלה מרכזית"] = b.question;
      if (b.alt !== undefined) map["ניסוחים חלופיים"] = b.alt;
      if (b.answer !== undefined) map["נוסח סופי / תיקון"] = b.answer;
      if (b.category !== undefined) map["קטגוריה"] = b.category;
      if (b.customerType !== undefined) map["סוג לקוחה"] = b.customerType;
      if (b.status !== undefined) map["סטטוס"] = b.status;
      if (b.health !== undefined) map["בריאותי"] = b.health ? "כן" : "";
      await updateById(b.id, map);
      return send(res, 200, { ok: true });
    }

    // ברירת מחדל: רשימה
    const { records } = await readAll();
    const admin = isAdmin(me);
    const list = records
      .filter(r => /^MP-\d{3}/.test(r["מזהה"] || ""))
      .filter(r => admin ? true : r["סטטוס"] === "מאושר")
      .map(r => ({
        id: r["מזהה"],
        question: r["שאלה מרכזית"] || "",
        alt: r["ניסוחים חלופיים"] || "",
        answer: bodyOf(r),
        category: r["קטגוריה"] || "",
        customerType: r["סוג לקוחה"] || "",
        status: r["סטטוס"] || "",
        kind: r["סוג"] || "מענה",
        health: r["בריאותי"] === "כן",
      }));

    const categories = [...new Set(list.map(r => r.category).filter(Boolean))].sort();
    return send(res, 200, { records: list, categories, canEdit: admin });
  } catch (e) {
    const msg = String(e.message || e);
    return send(res, msg === "unauthorized" ? 401 : 500, { error: msg });
  }
}
