/** src/lib/phraseBanks.ts - Pre-approved phrase templates for Mero. */

/** Language mode types. */
export type LanguageMode = "de" | "de_en" | "de_en_ne" | "nur_deutsch";

/** Greetings - returns [] for Nur Deutsch mode. */
export const greetings = (mode: LanguageMode, timeOfDay: "morning" | "afternoon" | "evening" | "streak"): string[] => {
  if (mode === "nur_deutsch") return [];
  if (timeOfDay === "morning") return ["Good morning!"];
  if (timeOfDay === "afternoon") return ["Good afternoon!"];
  return ["Good evening!"];
};

/** Encouragement - respects Nur Deutsch mode. */
export const encourage = (mode: LanguageMode, success: boolean, streak: number): string => {
  if (mode === "nur_deutsch") return success ? "Weiter so!" : "Fast geschafft!";
  const successMsg = success ? "Super!" : "Keep going!";
  const streakMsg = streak > 0 ? `${streak} Tage Serie!` : "Weiter so!";
  return successMsg + " " + streakMsg;
};

/** Celebrations - respects Nur Deutsch mode. */
export const celebrations = (mode: LanguageMode, type: "perfectQuiz" | "streak" | "checkpoint", value?: number): string => {
  if (mode === "nur_deutsch") return "";
  if (type === "perfectQuiz") return "Perfect quiz! 🎉";
  if (type === "streak") return "Streak saved! 🔥";
  if (type === "checkpoint") return "Checkpoint passed! 🎓";
  return "Great job!";
};

/** Nudges - respects Nur Deutsch mode. */
export const nudges = (mode: LanguageMode, type: "streakRisk" | "weakSkill" | "checkpoint"): string => {
  if (mode === "nur_deutsch") return "";
  if (type === "streakRisk") return "Are you still there?";
  if (type === "weakSkill") return "Would you like to practice your weak skill?";
  if (type === "checkpoint") return "Would you like to do the checkpoint?";
  return "Hmm?";
};