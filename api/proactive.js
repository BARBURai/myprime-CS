// ============================================================
// api/proactive.js — הודעות יזומות
// הצוות מקליד מה הוא רוצה לשלוח. קודם מחפשים במאגר בחינם,
// ורק אם אין התאמה מפעילים את המנוע כדי לנסח הצעה.
// POST {auth, text}
// ============================================================

import { readAll } from "../lib/sheets.js";
import { proactiveExact, proactiveSearch, proactivePool, bodyOf } from "../lib/engine.js";
import { draftProactive } from "../lib/ai.js";
import { requireUser } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

const asItem = r => ({
  id: r["מזהה"],
  title: r["שאלה מרכזית"] || "",
  trigger: r["מתי לשלוח (טריגר)"] || "",
  text: bodyOf(r),
  category: r["קטגוריה"] || "",
  note: r["הערה לצוות"] || "",
});

export default async function handler(req, res) {
  try {
    const b = await readBody(req);
    await requireUser(b);
    const { records } = await readAll();

    // רשימת כל ההודעות היזומות המאושרות, לתצוגה בתחתית המסך
    if (b.action === "list") {
      const items = proactivePool(records).map(asItem);
      const categories = [...new Set(items.map(x => x.category).filter(Boolean))].sort();
      return send(res, 200, { items, categories });
    }

    const text = (b.text || "").trim();
    if (!text) return send(res, 400, { error: "חסר תיאור" });

    // --- התאמה מדויקת, בחינם ---
    const exact = proactiveExact(records, text);
    if (exact) return send(res, 200, { mode: "found", items: [asItem(exact)], exact: true });

    // --- התאמה קרובה, עדיין בחינם ---
    const near = proactiveSearch(records, text, 5);
    if (near.length && near[0].score >= 0.45) {
      return send(res, 200, { mode: "found", items: near.map(x => asItem(x.rec)) });
    }

    // --- אין התאמה: ניסוח הצעה ---
    const existing = proactivePool(records).map(r => ({ trigger: r["מתי לשלוח (טריגר)"], q: r["שאלה מרכזית"] }));
    const out = await draftProactive({ situation: text, existing });
    return send(res, 200, {
      mode: "draft",
      draft: out.draft || "",
      trigger: out.trigger || text,
      question: out.question || text,
      category: out.category || "",
      // אם היו התאמות חלשות, נציג אותן כאפשרות בכל זאת
      suggestions: near.map(x => asItem(x.rec)),
    });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
