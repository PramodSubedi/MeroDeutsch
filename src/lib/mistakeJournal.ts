/** src/lib/mistakeJournal.ts - Local mistake journal for tracking tricky points. */

/** Entry in the mistake journal. */
export interface MistakeJournalEntry {
  id: string;
  type: "articles" | "meaning" | "word_order" | "fix_mistake" | "other";
  timestamp: number; // epoch ms
  /** The word/exercise the learner stumbled on. */
  lemma?: string;
  /** The error the learner made. */
  userAnswer?: string;
  /** The correct answer. */
  correctAnswer?: string;
  /** Error category/tag. */
  errorTag?: string;
  /** How many times this has been missed. */
  attemptCount: number;
  /** Last seen timestamp. */
  lastSeen: number;
}

/** Local storage key for the mistake journal. */
const MISTAKE_JOURNAL_KEY = "mero_mistake_journal";

/** Get the current mistake journal from localStorage. */
function getJournal(): MistakeJournalEntry[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(MISTAKE_JOURNAL_KEY);
  return data ? JSON.parse(data) : [];
}

/** Save the mistake journal to localStorage. */
function saveJournal(journal: MistakeJournalEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MISTAKE_JOURNAL_KEY, JSON.stringify(journal));
}

/** Add a new mistake entry. */
export function addMistake(entry: Omit<MistakeJournalEntry, "id" | "timestamp" | "attemptCount" | "lastSeen">): MistakeJournalEntry {
  const now = Date.now();
  const newEntry: MistakeJournalEntry = {
    id: `mj-${now}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: now,
    attemptCount: 1,
    lastSeen: now,
    ...entry,
  };

  let journal = getJournal();
  // Check if entry already exists (same type + lemma)
  const existingIndex = journal.findIndex(
    (e) =>
      e.type === entry.type &&
      e.lemma === entry.lemma &&
      e.errorTag === entry.errorTag
  );

  if (existingIndex >= 0) {
    // Increment attempt count and update lastSeen
    journal[existingIndex].attemptCount++;
    journal[existingIndex].lastSeen = now;
  } else {
    // Add new entry, cap at 50 entries
    journal.push(newEntry);
    if (journal.length > 50) {
      journal = journal.slice(journal.length - 50);
    }
  }

  saveJournal(journal);
  return newEntry;
}

/** Get all mistakes. */
export function getMistakes(): MistakeJournalEntry[] {
  return getJournal();
}

/** Get mistakes by type. */
function getMistakesByType(type: MistakeJournalEntry["type"]): MistakeJournalEntry[] {
  return getJournal().filter((e) => e.type === type);
}

/** Surface mistakes for review - returns top tricky points. */
export function surfaceMistakes(limit: number = 10): MistakeJournalEntry[] {
  const journal = getJournal();

  // Sort by attempt count (most frequent first), then by recency
  const sorted = journal.sort((a, b) => {
    if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
    return a.lastSeen - b.lastSeen;
  });

  return sorted.slice(0, limit);
}

/** Clear the mistake journal. */
export function clearMistakes(): void {
  saveJournal([]);
}