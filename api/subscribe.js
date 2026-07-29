// ============================================================
// api/subscribe.js — רישום מכשיר לקבלת פוש
// POST {auth, subscription} -> שומר את המכשיר תחת שם המשתמש
// GET  -> מחזיר את המפתח הציבורי לרישום בדפדפן
// ============================================================

import { saveSubscription } from "../lib/push.js";
import { requireUser } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return send(res, 200, { key: process.env.VAPID_PUBLIC_KEY || "" });
    }
    const b = await readBody(req);
    const me = await requireUser(b);
    if (!b.subscription) return send(res, 400, { error: "חסר מנוי" });
    await saveSubscription(me.name, b.subscription);
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
