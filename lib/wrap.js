// ============================================================
// wrap.js — בלוק העטיפה והפרסונליזציה
// המאגר שומר גוף תשובה בלבד. כאן מוסיפים תמיד פתיחה וחתימה.
// זה המקום היחיד לשינוי הפתיחה, האימוג'י או נוסח החתימה.
// ============================================================

import { LINKS, CLOSERS } from "./config.js";

const EMOJI = "🌷";

/** מחליף מציין מקום של קישור בקישור האמיתי, כדי שלא יישלח סוגר מרובע ללקוחה */
function fillLinks(text) {
  return (text || "")
    .replace(/\[\s*(קישור ההרשמה|קישור הרשמה|קישור לדף ההרשמה|קישור לוובינר|לינק|קישור)\s*\]/g, LINKS.webinar);
}

/** מנקה פתיחה או חתימה שנשמרו בטעות בתוך גוף התשובה. */
function stripWrappers(text) {
  let t = (text || "").trim();
  // הסרת פתיחה קיימת בתחילת הטקסט
  t = t.replace(/^היי\s*(\[שם\])?\s*[,\-–]?\s*🌷?\s*/u, "");
  // הסרת חתימה קיימת בסוף הטקסט
  t = t.replace(/\n*\s*[^\n]*,\s*צוות MyPrime\s*$/u, "");
  return t.trim();
}

/** שורת הפתיחה. עם שם או בלעדיו, תמיד עם הפרח. */
function opening(name) {
  const who = (name || "").trim();
  return who ? `היי ${who} ${EMOJI}` : `היי ${EMOJI}`;
}

/**
 * עוטף גוף תשובה בפתיחה, סיומת לפי שלב במשפך, וחתימה.
 * scope הוא סוג הלקוחה שנבחר. אם אינו ידוע, לא מתווספת סיומת.
 */
export function personalize(text, customerName, responder, scope) {
  const body = fillLinks(stripWrappers(text).replace(/\[שם\]/g, (customerName || "").trim() || ""));
  const sign = `${(responder || "").trim() || "צוות"}, צוות MyPrime`;
  const closer = CLOSERS[scope] ? fillLinks(CLOSERS[scope]) : "";
  const parts = [opening(customerName), "", body];
  if (closer) parts.push("", closer);
  parts.push("", sign);
  return parts.join("\n");
}
