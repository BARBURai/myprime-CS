// ============================================================
// ai.js — בלוק המנוע החושב (Sonnet)
// מופעל רק כשאין התאמה מדויקת. קורא את הודעת הלקוחה, מחליט אם
// חסר לו הקשר ושואל, או מנסח הצעת תשובה בקול ענת. מחזיר JSON.
// המפתח יושב במשתנה הסביבה ANTHROPIC_API_KEY.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "./config.js";

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `את עוזרת ניסוח לשירות הלקוחות של MyPrime, מותג בריאות לנשים בגיל המעבר. הקול הוא של ענת: חם במידה, מקצועי וישיר, לא מתחנף ולא קיצי. עברית בלבד, מקפים קצרים, בלי "אהובה"/"באהבה", בלי להציג את התוכנית כ"קסם". אסור לנקוב במחיר, תאריך, מספר תשלומים או קופון - מפנים למפגש או לדף ההרשמה.

תפקידך: לקבל הודעה של לקוחה, הקשר ידוע, ורשימת שאלות-תשובות מאושרות (מזהה, שאלה, סוג לקוחה, קטגוריה), ולהחליט אחת משלוש:
- "answer": אם קיימת בדיוק תשובה מאושרת אחת שעונה על ההודעה בהינתן ההקשר. החזירי את המזהה שלה.
- "ask": אם כדי לענות נכון חסר הקשר שמשנה את התשובה (למשל אם היא לקוחה קיימת או עדיין לא, מתי התחילה, וכל פרט שלא הופיע בהודעה). שאלי עד שתי שאלות קצרות, כל אחת עם 2 עד 4 כפתורים. אל תשאלי לעולם על השם.
- "draft": אם אין תשובה מאושרת מתאימה. נסחי גוף תשובה חדש בקול ענת (בלי פתיחה ובלי חתימה), והציעי שדות.

החזירי JSON תקין בלבד, בלי טקסט לפני או אחרי, במבנה:
{"action":"answer","id":"MP-000"}
או {"action":"ask","questions":[{"key":"customerType","q":"...","options":["...","..."]}]}
או {"action":"draft","draft":"גוף התשובה","fields":{"category":"...","customerTypes":["..."],"health":false}}`;

export async function assist({ message, context, candidates }) {
  const list = candidates.map(c =>
    `${c.id} | ${c.q} | סוג לקוחה: ${c.types || "לא צוין"} | ${c.cat}`).join("\n");
  const user = `הודעת הלקוחה:\n"${message}"\n\nהקשר ידוע: ${JSON.stringify(context || {})}\n\nשאלות מאושרות במאגר:\n${list}`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 900,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const text = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); }
  catch { return { action: "draft", draft: clean, fields: {} }; }
}
