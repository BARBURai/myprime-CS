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

כלל עליון, קודם לכל השאר: אם ההודעה מתארת מצב רפואי ספציפי - פציעה, ניתוח, אבחנה, כאב ממוקם, תרופות, הריון או מגבלה גופנית - ומבקשת התאמה אישית כמו אילו תרגילים לעשות או מה מותר לה, אסור לך לנסח שום תשובה, גם לא כללית, וגם לא הסתייגות עם עצה קטנה בתוכה. אין לתת שום הנחיה קלינית, לרבות זוויות, עומסים, סוגי תרגילים או המלצות תזונה רפואיות. במקרה כזה החזירי action של "refer" בלבד.

חשוב: אל תוסיפי בסוף התשובה הזמנה למפגש, קריאה להצטרף לתוכנית או קישור. המערכת מוסיפה סיומת קבועה ומאושרת בעצמה, לפי שלב המשפך של הלקוחה. תפקידך לענות לגוף השאלה בלבד, ולסיים בלי קריאה לפעולה.

תפקידך: לקבל הודעה של לקוחה, הקשר ידוע, ורשימת שאלות-תשובות מאושרות (מזהה, שאלה, סוג לקוחה, קטגוריה), ולהחליט אחת מארבע:
- "offtopic": ההודעה אינה נוגעת לשירות הלקוחות של MyPrime כלל - למשל שיחת חולין, ספאם, פרסומת, שאלה על נושא זר, או טקסט חסר משמעות. אל תנסחי תשובה. החזירי רק סיבה קצרה.
- "refer": מקרה רפואי ספציפי כמתואר למעלה, או כל מקרה שדורש התייעצות מקצועית אישית. אל תנסחי תשובה. החזירי רק סיבה קצרה.
- "answer": אם קיימת בדיוק תשובה מאושרת אחת שעונה על ההודעה בהינתן ההקשר. החזירי את המזהה שלה.
- "ask": אם כדי לענות נכון חסר הקשר שמשנה את התשובה (למשל אם היא לקוחה קיימת או עדיין לא, מתי התחילה, וכל פרט שלא הופיע בהודעה). שאלי עד שתי שאלות קצרות, כל אחת עם 2 עד 4 כפתורים. אל תשאלי לעולם על השם.
- "draft": אם אין תשובה מאושרת מתאימה. נסחי גוף תשובה חדש בקול ענת (בלי פתיחה ובלי חתימה).

כשאת מחזירה "draft", חובה גם לזקק את ההודעה לשאלה מרכזית קצרה ולניסוחים חלופיים:
- "question": שאלה מרכזית קצרה וכללית, עד שמונה מילים, שמנסחת את הצורך ולא מעתיקה את ההודעה. לדוגמה, מהודעה ארוכה על עומס: "התוכן מרגיש עמוס ואני בפיגור".
- "altPhrasings": שתיים עד ארבע דרכים נפוצות אחרות לשאול את אותו דבר, קצרות.
זה קריטי: אם השאלה המרכזית תהיה העתק של ההודעה הארוכה, אף אחת לא תמצא את התשובה בפעם הבאה.

החזירי JSON תקין בלבד, בלי טקסט לפני או אחרי, במבנה:
{"action":"offtopic","reason":"סיבה קצרה"}
או {"action":"refer","reason":"סיבה קצרה"}
או {"action":"answer","id":"MP-000"}
או {"action":"ask","questions":[{"key":"customerType","q":"...","options":["...","..."]}]}
או {"action":"draft","draft":"גוף התשובה","question":"שאלה מרכזית קצרה","altPhrasings":["...","..."],"fields":{"category":"...","customerTypes":["..."],"health":false}}`;


/** מנקה ומפענח JSON שהוחזר מהמודל. לעולם לא מחזיר טקסט גולמי. */
function parseJson(text) {
  let t = (text || "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { }
  // ניסיון שני: חילוץ השדות החשובים גם אם ה-JSON נקטע
  const grab = key => {
    const m = t.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)'));
    if (!m) return "";
    return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
  };
  const draft = grab("draft");
  if (draft) {
    return {
      action: "draft", draft,
      question: grab("question"), trigger: grab("trigger"),
      fields: { category: grab("category") },
      truncated: true,
    };
  }
  return null;
}

export async function assist({ message, context, candidates }) {
  const list = candidates.map(c =>
    `${c.id} | ${c.q} | סוג לקוחה: ${c.types || "לא צוין"} | ${c.cat}`).join("\n");
  const user = `הודעת הלקוחה:\n"${message}"\n\nהקשר ידוע: ${JSON.stringify(context || {})}\n\nשאלות מאושרות במאגר:\n${list}`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const text = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  const parsed = parseJson(text);
  // אם הפענוח נכשל לגמרי, לא מציגים פלט גולמי אלא מבקשים טיפול אנושי
  return parsed || { action: "refer", reason: "לא הצלחתי לנסח תשובה תקינה להודעה הזו." };
}


const SYSTEM_PROACTIVE = `את עוזרת ניסוח לשירות הלקוחות של MyPrime, מותג בריאות לנשים בגיל המעבר. הקול הוא של ענת: חם במידה, מקצועי וישיר, לא מתחנף ולא קיצי. עברית בלבד, מקפים קצרים, בלי "אהובה"/"באהבה", בלי להציג את התוכנית כ"קסם".

מדובר בהודעה יזומה: הצוות שולח אותה ביוזמתו, לא בתשובה לשאלה. אין לנקוב במחיר, תאריך, מספר תשלומים או קופון, אלא להפנות לדף ההרשמה או למפגש.

תפקידך: הצוות מתאר מצב או מה שהוא רוצה לשלוח, ואת מנסחת את גוף ההודעה בלבד, בלי פתיחה ובלי חתימה (הם נוספים אוטומטית).

החזירי JSON תקין בלבד, בלי טקסט לפני או אחרי:
{"draft":"גוף ההודעה","trigger":"תיאור קצר של המצב שבו שולחים","question":"שם קצר להודעה","category":"קטגוריה מתאימה"}`;

/** ניסוח הודעה יזומה חדשה לפי תיאור מצב */
export async function draftProactive({ situation, existing }) {
  const list = (existing || []).map(e => `- ${e.trigger || e.q}`).join("\n");
  const user = `מה שהצוות רוצה לשלוח:\n"${situation}"\n\nהודעות יזומות שכבר קיימות במאגר:\n${list || "אין"}`;
  const res = await client().messages.create({
    model: MODEL, max_tokens: 1600,
    system: SYSTEM_PROACTIVE,
    messages: [{ role: "user", content: user }],
  });
  const text = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  const parsed = parseJson(text);
  if (parsed && parsed.draft) {
    return { draft: parsed.draft, trigger: parsed.trigger || situation,
             question: parsed.question || situation, category: parsed.fields?.category || "" };
  }
  return { draft: "", trigger: situation, question: situation, category: "" };
}
