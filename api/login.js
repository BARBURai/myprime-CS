// ============================================================
// api/login.js — כניסה
// POST {email, code} -> {ok, name, email, role}
// ============================================================

import { verify } from "../lib/users.js";
import { readBody, send } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const { email, code } = await readBody(req);
    const u = await verify(email, code);
    if (!u) return send(res, 401, { error: "המייל או הקוד אינם נכונים, או שהגישה חסומה" });
    return send(res, 200, { ok: true, ...u });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
}
