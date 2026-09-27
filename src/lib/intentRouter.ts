/**
 * src/lib/intentRouter.ts — classify what the learner is asking for.
 *
 * WHY RULES, NOT THE MODEL
 * ------------------------
 * Intent is a ROUTING decision, and a 3B model asked to also role-play a
 * teasing owl would eventually return a paragraph of banter labelled
 * "vocab_lookup". Keeping classification deterministic means the prompt
 * assembly, the fallback reply, and the avatar mood are all reproducible.
 *
 * PRECEDENCE IS DELIBERATE
 * -----------------------
 *   explain_mistake   before grammar_question
 *       "Why was I wrong about the article?" is both; the mistake-specific
 *       handler has the actual wrong/right pair to work with, so it wins.
 *   vocab_lookup      before conversation
 *       Any quoted term is a lookup even if the sentence looks chattery.
 *   progress_check    before motivation
 *       "I'm frustrated, my XP isn't moving" wants data first.
 *
 * German, English and Nepali keywords are all in scope because the app is
 * trilingual by default (`.clinerules` C1.5 / C2.10).
 */

import type { ContextSnapshot, Intent } from '../types/chatbot';

interface Rule {
  intent: Intent;
  patterns: RegExp[];
  /** Higher wins on a tie. Mirrors the precedence described above. */
  weight: number;
}

/** Tie-break order — also the documentation of intent precedence. */
const RULES: Rule[] = [
  {
    intent: 'explain_mistake',
    weight: 10,
    patterns: [
      /warum\s+(hat|war|habe|bin|ist)|weshalb|wie\s+kommt\s+das/i,
      /falsch|fehler|verwechsel|wrong|mistake|incorrect|错|गलत/i,
      /kannst\s+du\s+erkl|explain|erklär|explain\s+why/i,
    ],
  },
  {
    intent: 'vocab_lookup',
    weight: 9,
    patterns: [
      /was\s+bedeutet|bedeutet|meaning|means|what'?s\s+the\s+word/i,
      // "how do you say" AND "how do I say" — the informal form is the common one.
      /how\s+(do|can|would)\s+(you|i)\s+say|übersetz|translate/i,
      /अर्थ|के\s+लागि|मतलब/i,
    ],
  },
  {
    intent: 'practice_suggestion',
    weight: 8,
    patterns: [
      // `practi[cs]e` — British and American spellings, plus drill/repeat.
      // The `was`/`what` prefix is part of the match: "Was sollte ich üben?"
      // and "What should I practise?" are the same question in two languages.
      // (Nesting `what should i` INSIDE a `was\s+` group silently killed the
      // English phrasing — it must be a top-level alternation.)
      /(\bwas\b\s+|\bwhat\b\s+)(sollte?ich|soll|should\s+i|kann\s+i).{0,30}(üben|lernen|train|practi[cs]e|study|drill|repeat)/i,
      /empfehl|recommend|suggest|which\s+(tool|drill|activity)/i,
      /अभ्यास|के\s+अभ्यास/,
    ],
  },
  {
    intent: 'curriculum_help',
    weight: 7,
    patterns: [
      /wo\s+bin\s+ich|where\s+am\s+i|which\s+(unit|module|lesson)|welche\s+(einheit|modul|lektion)/i,
      /was\s+kommt\s+(als\s+nächst|jetzt|next)|next\s+(unit|module|step)/i,
      /fortschritt\s+im\s+(kurs|pfad)|curriculum|spine/i,
    ],
  },
  {
    intent: 'progress_check',
    weight: 7,
    patterns: [
      /wie\s+weit|fortschritt|wie\s+stehe\s+ich|wie\s+ist\s+mein/i,
      // "how am I doing" / "how's it going" are the everyday phrasings —
      // a learner almost never says the word "progress".
      /how\s+(am|is)\s+(i|my\s+\w+)\s+(doing|going)|how'?s\s+it\s+going|how\s+are\s+(you\s+doing|things)/i,
      /progress|\bxp\b|level\b|serie|streak|rank\b|stand\b/i,
    ],
  },
  {
    intent: 'grammar_question',
    weight: 6,
    patterns: [
      /grammatik|grammar|regel|rule\b|artikel|article\b|akkusativ|dativ|Genitiv/i,
      /konjug|conjug|konjugation|tense|wortstellung|word\s+order|declension|case\b/i,
      /umlaut|ß\b|sound|pronunciation|aus sprech|aussprache/i,
    ],
  },
  {
    intent: 'motivation',
    weight: 5,
    patterns: [
      /frustr|aufgeben|give\s+up|motivat|disheart|can'?t\s+(do|keep)|schaffe\s+nicht/i,
      /schwer|hard\b|too\s+hard|थक|हार|निराश/i,
    ],
  },
  {
    intent: 'settings',
    weight: 6,
    patterns: [
      /einstellung|setting|konfigur|configur|which\s+model|welches\s+modell/i,
      /intensit|wie\s+viel|wie\s+groß|personality|persönlichkeit/i,
      /\bollama\b|\blm\s?studio\b|base\s?url|server/i,
    ],
  },
  {
    intent: 'start_quiz',
    weight: 11,
    patterns: [
      /quiz\s+me|test\s+me|drill\s+me|practi[cs]e\s+with\s+me/i,
      /prüf\s+mich|abfrage|teste\s+mich|übe\s+mit\s+mir/i,
      /start\s+(a\s+)?(quiz|drill|round)|lass\s+uns\s+üben/i,
      /\?(quiz|drill)\b/,
    ],
  },
  {
    intent: 'page_help',
    // Weighted ABOVE explain_mistake on purpose. "Explain this page" matches
    // BOTH rules equally well, and the earlier rule used to win the tie — so a
    // page question was answered as a mistake explanation. A page-scoped
    // question is the more specific signal and must win.
    weight: 12,
    patterns: [
      /(explain|what|help)\s+(is\s+)?(this|the)\s+(page|screen|tab)/i,
      /what\s+am\s+i\s+(looking\s+at|doing)|on\s+this\s+page/i,
      // German allows an object between the verb and the noun ("erkläre MIR
      // diese Seite"), so up to two filler words are tolerated before the
      // page noun — otherwise only the bare "erkläre Seite" ever matched.
      /erklär\w*\s+(?:\S+\s+){0,2}(seite|bildschirm|modul)|was\s+mache\s+ich\s+gerade/i,
    ],
  },
  {
    intent: 'report',
    weight: 10,
    patterns: [
      /weekly\s+report|week\s+in\s+review|summary|how\s+did\s+i\s+do/i,
      /wochen(bericht|ruckblick)|zusammenfassung|wie\s+habe\s+ich\s+gemacht/i,
      /fortschritt\s+bericht/i,
    ],
  },
  {
    intent: 'conversation',
    weight: 4,
    patterns: [/\b(hi|hello|hallo|hey|guten\s+tag|moin|servus|tschüss|bye|danke|thanks)\b/i],
  },
];

/** Pull the term out of "what does X mean?" / "wie sagt man X". */
export function extractQuotedTerm(message: string): string | null {
  const quoted = message.match(/["'“”„«»]([^"'“”„«»]{1,40})["'“”„«»]/);
  if (quoted) return quoted[1].trim();
  // …means "X", or: X = ?
  const inline = message.match(/(?:means|bedeutet)\s+([\wÄÖÜäöüß-]{2,30})/i);
  return inline ? inline[1] : null;
}

function score(intent: Intent, message: string, context?: ContextSnapshot): number {
  const rule = RULES.find((r) => r.intent === intent);
  if (!rule) return 0;

  let total = 0;
  for (const pattern of rule.patterns) {
    if (pattern.test(message)) total += rule.weight;
  }

  // CRITICAL: a context boost may only RE-RANK an intent that already matched.
  //
  // Without this guard the boosts below manufacture matches out of nothing.
  // "no weakest skill and nothing due" is the DEFAULT state of every brand-new
  // learner, so an unguarded practice_suggestion boost scored 2 on EVERY
  // message and hijacked the router — asking "How am I doing?" was answered
  // with a practice recommendation.
  if (total === 0) return 0;

  // Ties only. "Why is my article wrong?" with tagged article errors in the
  // queue is a mistake explanation even without an explicit "falsch" token.
  if (
    intent === 'explain_mistake' &&
    context?.review.recent.some((r) => r.errorTag === 'article') &&
    /artikel|article/i.test(message)
  ) {
    total += 6;
  }
  // Asked to practise, but there is nothing measurable yet — the curriculum-
  // aware handler is the better of the two practice answers.
  if (intent === 'practice_suggestion' && context && !context.weakestSkill && context.review.due === 0) {
    total += 2;
  }
  return total;
}

export function classifyIntent(message: string, context?: ContextSnapshot): Intent {
  const text = message.trim();
  if (!text) return 'casual_chat';

  let best: Intent = 'casual_chat';
  let bestScore = 0;
  for (const rule of RULES) {
    const value = score(rule.intent, text, context);
    if (value > bestScore) {
      bestScore = value;
      best = rule.intent;
    }
  }

  // A quoted term is a lookup even when nothing else matched.
  if (bestScore === 0 && extractQuotedTerm(text)) return 'vocab_lookup';
  return best;
}
