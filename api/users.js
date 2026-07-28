// ============================================================
// api/users.js — ניהול משתמשים (למנהל בלבד)
// POST {auth, action}
//   list        -> רשימת המשתמשים
//   add         -> {name, email, code, role}
//   setCode     -> {row, code}     שינוי קוד ידני
//   resetCode   -> {row}           איפוס לקוד אקראי חדש
//   toggle      -> {row, active}   חסימה או שחרור
// ============================================================

import { allUsers, addUser, updateUserRow, randomCode, requireUser, isAdmin } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const b = await readBody(req);
    const me = await requireUser(b);
    if (!isAdmin(me)) return send(res, 403, { error: "אין הרשאה" });

    if (b.action === "list") {
      const users = await allUsers();
      return send(res, 200, { users });
    }
    if (b.action === "add") {
      const code = (b.code || "").trim() || randomCode();
      await addUser({ name: b.name, email: b.email, code, role: b.role });
      return send(res, 200, { ok: true, code });
    }
    if (b.action === "setCode") {
      await updateUserRow(b.row, { "קוד": (b.code || "").trim() });
      return send(res, 200, { ok: true, code: b.code });
    }
    if (b.action === "resetCode") {
      const code = randomCode();
      await updateUserRow(b.row, { "קוד": code });
      return send(res, 200, { ok: true, code });
    }
    if (b.action === "toggle") {
      await updateUserRow(b.row, { "פעיל": b.active ? "כן" : "לא" });
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { error: "פעולה לא מוכרת" });
  } catch (e) {
    const msg = String(e.message || e);
    return send(res, msg === "unauthorized" ? 401 : 500, { error: msg === "unauthorized" ? "נדרשת כניסה" : msg });
  }
}
