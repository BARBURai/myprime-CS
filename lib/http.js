// ============================================================
// http.js — עזרי צד שרת קטנים
// ============================================================

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise(resolve => {
    let d = ""; req.on("data", c => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}
