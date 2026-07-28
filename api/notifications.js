// ============================================================
// api/notifications.js — התראות
// GET ?to=טלי -> ההתראות של המשתמש (מהחדשה לישנה)
// ============================================================

import { listNotifications } from "../lib/sheets.js";
import { send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const to = (req.query && req.query.to) ||
      new URL(req.url, "http://x").searchParams.get("to") || "all";
    const items = (await listNotifications(to))
      .sort((a, b) => (b["מתי"] || "").localeCompare(a["מתי"] || ""))
      .slice(0, 30)
      .map(r => ({ when: r["מתי"], type: r["סוג"], text: r["טקסט"], ref: r["הפניה"] }));
    return send(res, 200, { items });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e), items: [] });
  }
}
