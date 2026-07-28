// ============================================================
// wrap.js — בלוק העטיפה והפרסונליזציה
// מוסיף פתיחה, שם הלקוחה וחתימה בזמן המענה. מקום אחד לשינוי
// הפתיחה, האימוג'י או נוסח החתימה.
// ============================================================

/** מכניס את שם הלקוחה לפתיחה ומוסיף חתימה בשם המשיב/ה. */
export function personalize(text, customerName, responder) {
  const name = (customerName || "").trim();
  const who = (responder || "טלי").trim();
  let t = text;
  if (name) {
    t = t.replace(/\[שם\]/g, name);
  } else {
    t = t.replace(/היי \[שם\],?\s*/g, "היי 🌷 ").replace(/\[שם\]/g, "").trim();
  }
  if (!/צוות MyPrime/.test(t)) {
    t = t.trim() + "\n\n" + who + ", צוות MyPrime";
  }
  return t;
}
