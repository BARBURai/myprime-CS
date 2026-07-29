// ============================================================
// api/notifications.js — התראות
// GET ?to=טלי -> ההתראות של המשתמש (מהחדשה לישנה)
// ============================================================

import { listNotifications, markRead } from "../lib/sheets.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const b = await readBody(req);
      await markRead(b.rows || []);
      return send(res, 200, { ok: true });
    }
    const to = (req.query && req.query.to) ||
      new URL(req.url, "http://x").searchParams.get("to") || "all";
    const items = (await listNotifications(to))
      .sort((a, b) => (b["מתי"] || "").localeCompare(a["מתי"] || ""))
      .slice(0, 30)
      .map(r => ({ row: r._row, when: r["מתי"], type: r["סוג"], text: r["טקסט"], ref: r["הפניה"], from: r["מאת"] || "" }));
    return send(res, 200, { items });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e), items: [] });
  }
}
