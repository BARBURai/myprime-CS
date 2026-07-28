// ============================================================
// api/assist.js — נתיב העוזר
// שלב 1: התאמה מדויקת חינם. שלב 2 (רק אם צריך): המנוע החושב.
// ============================================================

import { readAll } from "../lib/sheets.js";
import { exactMatch, pool, bodyOf } from "../lib/engine.js";
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
    });

    // --- שלב 2: מנוע חושב (Sonnet) ---
    const candidates = pool(records, scope).map(r => ({
      id: r["מזהה"], q: r["שאלה מרכזית"], types: r["סוג לקוחה"], cat: r["קטגוריה"],
    }));
    const out = await assist({ message, context, candidates });

    if (out.action === "answer" && out.id) {
      const rec = records.find(r => r["מזהה"] === out.id);
      if (rec) return send(res, 200, {
        mode: "answer", id: rec["מזהה"], text: bodyOf(rec),
        category: rec["קטגוריה"], health: rec["בריאותי"] === "כן",
      });
    }
    if (out.action === "ask") return send(res, 200, { mode: "ask", questions: out.questions || [] });
    return send(res, 200, { mode: "draft", draft: out.draft || "", fields: out.fields || {} });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
