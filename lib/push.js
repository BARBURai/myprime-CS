// ============================================================
// push.js — בלוק הפוש
// שומר מנויי מכשירים בלשונית "מנויים" ושולח אליהם התראות,
// גם כשהאפליקציה סגורה. ההתראה נשלחת לכל המכשירים של המשתמש.
// דורש שני משתני סביבה: VAPID_PUBLIC_KEY ו-VAPID_PRIVATE_KEY.
// ============================================================

import webpush from "web-push";
import { readAll, appendRow } from "./sheets.js";
import { TAB_SUBS } from "./config.js";

function configure() {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:info@myprime.co.il", pub, priv);
  return true;
}

/** שמירת מנוי חדש למכשיר. */
export async function saveSubscription(userName, sub) {
  await appendRow({
    "אל": userName,
    "endpoint": sub.endpoint,
    "p256dh": sub.keys?.p256dh || "",
    "auth": sub.keys?.auth || "",
    "מתי": new Date().toISOString(),
  }, TAB_SUBS);
}

/** שליחת התראה לכל המכשירים של משתמש. לא זורק שגיאה אם נכשל. */
export async function pushTo(userName, { title, body, ref }) {
  try {
    if (!configure()) return;
    const { records } = await readAll(TAB_SUBS);
    const mine = records.filter(r => (r["אל"] || "").trim() === (userName || "").trim());
    const payload = JSON.stringify({ title, body, ref });

    await Promise.all(mine.map(r =>
      webpush.sendNotification({
        endpoint: r["endpoint"],
        keys: { p256dh: r["p256dh"], auth: r["auth"] },
      }, payload).catch(() => null)
    ));
  } catch { /* התראה שנכשלה לא שוברת את הפעולה */ }
}
