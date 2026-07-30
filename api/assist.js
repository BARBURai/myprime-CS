// ============================================================
// api/assist.js — נתיב העוזר
// שלב 1: התאמה מדויקת חינם. שלב 2 (רק אם צריך): המנוע החושב.
// ============================================================

import { readAll } from "../lib/sheets.js";
import { exactMatch, fuzzyMatch, pool, bodyOf, generalFor } from "../lib/engine.js";
import { assist } from "../lib/ai.js";
import { requireUser } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const body = await readBody(req);
    await requireUser(body);
    const { message, scope = "all", context = {} } = body;
    if (!message) return send(res, 400, { error: "no-message" });

    const { records } = await readAll();

    // --- שלב 1: התאמה מדויקת, חינם ---
    const m = exactMatch(records, message, scope);
    if (m) return send(res, 200, {
      mode: "answer", id: m["מזהה"], text: bodyOf(m),
      category: m["קטגוריה"], health: m["בריאותי"] === "כן",
      matchedQuestion: m["שאלה מרכזית"], note: m["הערה לצוות"] || "",
    });

    // --- שלב 2: התאמה קרובה, עדיין בלי טוקנים ---
    const near = fuzzyMatch(records, message, scope);
    if (near) {
      const r = near.rec;
      return send(res, 200, {
        mode: "answer", id: r["מזהה"], text: bodyOf(r),
        category: r["קטגוריה"], health: r["בריאותי"] === "כן",
        matchedQuestion: r["שאלה מרכזית"], near: true, note: r["הערה לצוות"] || "",
      });
    }

    // --- שלב 3: מנוע חושב (Sonnet) ---
    const candidates = pool(records, scope).map(r => ({
      id: r["מזהה"], q: r["שאלה מרכזית"], types: r["סוג לקוחה"], cat: r["קטגוריה"],
    }));
    const out = await assist({ message, context, candidates });

    if (out.action === "answer" && out.id) {
      const rec = records.find(r => r["מזהה"] === out.id);
      if (rec) return send(res, 200, {
        mode: "answer", id: rec["מזהה"], text: bodyOf(rec),
        category: rec["קטגוריה"], health: rec["בריאותי"] === "כן",
        matchedQuestion: rec["שאלה מרכזית"], note: rec["הערה לצוות"] || "",
      });
    }
    if (out.action === "ask") return send(res, 200, { mode: "ask", questions: out.questions || [] });

    // מקרה שדורש התייעצות מקצועית: לא מנסחים כלום
    if (out.action === "refer") {
      return send(res, 200, {
        mode: "refer",
        reason: out.reason || "ההודעה מתארת מצב רפואי ספציפי שדורש התייחסות מקצועית אישית.",
      });
    }
    // לפני שמנסחים משהו חדש: אם יש נוסח כללי מאושר לקטגוריה, מגישים אותו
    const gen = generalFor(records, out.fields?.category);
    if (gen) {
      return send(res, 200, {
        mode: "answer", id: gen["מזהה"], text: bodyOf(gen),
        category: gen["קטגוריה"], health: gen["בריאותי"] === "כן",
        matchedQuestion: gen["שאלה מרכזית"], note: gen["הערה לצוות"] || "",
        general: true,
        generalReason: `לא נמצאה תשובה מדויקת להודעה הזו, ולכן מוצג הנוסח הכללי המאושר בנושא ${gen["קטגוריה"] || "הזה"}.`,
      });
    }

    return send(res, 200, {
      mode: "draft", draft: out.draft || "",
      question: out.question || "", altPhrasings: out.altPhrasings || [],
      fields: out.fields || {},
    });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
