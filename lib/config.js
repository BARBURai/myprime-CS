// ============================================================
// config.js — בלוק ההגדרות
// כל הקבועים במקום אחד. המפתחות הסודיים (Anthropic, גוגל) לא
// כאן אלא במשתני הסביבה של Vercel. כאן רק מה שלא סודי.
// ============================================================

export const SHEET_ID = "15SUF0too26cOFJGAaNMC8wDE7aYFc4O-lMMsjZNJ8VY";

// שמות הלשוניות בגיליון.
export const TAB_MAIN = "מאגר MyPrime";       // השאלות והתשובות
export const TAB_NOTES = "התראות";            // לוג התראות
export const TAB_USERS = "משתמשים";           // משתמשים והרשאות

// מודל ה-AI. Sonnet: איזון של חוכמה ומחיר. ניתן לעדכן כאן בלבד.
export const MODEL = "claude-sonnet-5";

// סף לפני שמפעילים את המנוע החושב (שמור לעתיד; כרגע 1 = רק התאמה מדויקת חינם).
export const EXACT_ONLY_FIRST = true;
