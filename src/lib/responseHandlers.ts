/**
 * src/lib/responseHandlers.ts — per-intent grounding.
 *
 * THE ONE IMPORTANT DESIGN DECISION HERE
 * --------------------------------------
 * These handlers DO NOT write the answer. Each returns a `ResponsePlan`:
 *
 *   contextBlock   — authoritative facts pasted into the system prompt
 *   fallbackReply  — a deterministic reply used when the model is unreachable
 *
 * Why not let the handler answer directly? Because then this is a rules engine
 * wearing a mascot costume, and the "AI companion" does nothing. Why not let
 * the model answer ungrounded? Because a 3B model asked "how am I doing?"
 * invents a confident, wrong streak count.
 *
 * So: the handler decides WHAT IS TRUE, the prompt carries it, and the model
 * decides HOW TO SAY IT IN CHARACTER. The fallback guarantees the feature is
 * still useful with Ollama switched off.
 */

import { A1_CURRICULUM } from '../data/a1Path';
import { ANCHORS } from './anchors';
import type { ContextSnapshot, Intent, MeroMood, ReportSection, ResponsePlan } from '../types/chatbot';
import type { VocabHit } from './vocabLookup';
import type { ConversationState } from './conversationManager';
import { levelForContext } from './conversationManager';
import { extractQuotedTerm } from './intentRouter';

export interface HandleInput {
  intent: Intent;
  message: string;
  context: ContextSnapshot;
  /** Present for `vocab_lookup` when the word was found in `db.vocab`. */
  vocabHit?: VocabHit | null;
  conversation?: ConversationState;
  /** Assembled screen context for `page_help`. */
  page?: { label: string; facts: string[]; focus: { subject: string; detail?: string } | null } | null;
  /** Assembled report rows for `report`. */
  report?: ReportSection[];
}

/* ── formatting helpers ───────────────────────────────────────────────────── */

interface LocalizedLabel {
  en: string;
  de: string;
}

/** Respect "Nur Deutsch" — hide EN labels there (`.clinerules` C1.5). */
const pick = (label: LocalizedLabel | undefined, isDE: boolean): string =>
  label ? (isDE ? label.de : label.en) : '';

const SKILL_LABEL: Record<string, LocalizedLabel> = {
  grammar: { en: 'Grammar', de: 'Grammatik' },
  vocabulary: { en: 'Vocabulary', de: 'Wortschatz' },
  listening: { en: 'Listening', de: 'Hören' },
  spelling: { en: 'Spelling', de: 'Rechtschreibung' },
};

const skillName = (category: string, isDE: boolean): string =>
  SKILL_LABEL[category] ? pick(SKILL_LABEL[category], isDE) : category;

const pct = (n: number): string => `${Math.round(n)}%`;

/** Clamp a module index into the real curriculum range. */
function safeUnit(index: number): number {
  return Math.max(0, Math.min(index, A1_CURRICULUM.units.length - 1));
}

function unitAt(index: number) {
  return A1_CURRICULUM.units[safeUnit(index)];
}

/* ── progress ─────────────────────────────────────────────────────────────── */

export function handleProgressCheck(ctx: ContextSnapshot): ResponsePlan {
  const { xp, streak, a1, skills, review } = ctx;
  const measured = skills.filter((s) => s.total > 0);
  const best = measured.length
    ? measured.reduce((a, b) => (a.accuracy >= b.accuracy ? a : b))
    : null;

  const contextBlock = [
    'LEARNER PROGRESS — authoritative. Quote these numbers exactly; never invent one.',
    `- XP: ${xp.totalXp} total · level ${xp.level} · rank "${xp.rank}" · ${xp.xpToNextLevel} XP to level ${xp.level + 1}`,
    `- Streak: ${streak.current} day(s) current, best ${streak.longest}`,
    `- A1 spine: module ${a1.unitIndex + 1} of ${A1_CURRICULUM.units.length} — "${a1.unitTitle}" · ${a1.completedCount}/${a1.totalLearnNodes} nodes done · ${a1.passedCheckpoints} checkpoint(s) passed`,
    review.due > 0
      ? `- Review queue: ${review.total} items, ${review.due} due right now`
      : `- Review queue: ${review.total} items, none due right now`,
    measured.length
      ? `- Skill accuracy: ${measured.map((s) => `${skillName(s.category, ctx.isDE)} ${pct(s.accuracy)} (${s.total} answers)`).join(', ')}`
      : '- Skill accuracy: not enough answers recorded yet',
  ].join('\n');

  // German plural on the streak: "1 Tag" vs "3 Tage".
  const streakLine =
    streak.current > 0
      ? ctx.isDE
        ? `${streak.current} ${streak.current === 1 ? 'Tag' : 'Tage'} Serie.`
        : `${streak.current}-day streak.`
      : '';

  const parts = [
    ctx.isDE
      ? `Du bist auf Level ${xp.level} (${xp.rank}) mit ${xp.totalXp} XP.`
      : `You're level ${xp.level} (${xp.rank}) with ${xp.totalXp} XP.`,
    streakLine,
    (ctx.isDE ? `Modul ${a1.unitIndex + 1}: ` : `Module ${a1.unitIndex + 1}: `) + a1.unitTitle + '.',
    best
      ? (ctx.isDE ? 'Stärkste Fähigkeit: ' : 'Strongest skill: ') + skillName(best.category, ctx.isDE) + ' ' + pct(best.accuracy) + '.'
      : '',
  ].filter(Boolean);

  return {
    intent: 'progress_check',
    contextBlock,
    fallbackReply: parts.join(' '),
    // A chart reads faster than the sentence, and costs the model nothing.
    payload: {
      kind: 'progress',
      level: xp.level,
      totalXp: xp.totalXp,
      xpToNextLevel: xp.xpToNextLevel,
      rank: xp.rank,
      streak: streak.current,
      skills: ctx.skills,
      dueCount: ctx.review.due,
    },
    suggestedAction: a1.pushNode
      ? {
          label: ctx.isDE ? 'Weiterlernen' : 'Continue learning',
          to: a1.pushNode.to,
        }
      : undefined,
    mood: xp.level >= 5 ? 'proud' : 'idle',
  };
}

/* ── what to practise next ────────────────────────────────────────────────── */

/** Where to send a learner who has an `errorTag`, from the review queue. */
const ERROR_TAG_ROUTE: Record<string, string> = {
  article: '/articles',
  verb: '/grammar',
  spelling: '/alphabet',
  listening: '/dictation',
};

export function handlePracticeSuggestion(ctx: ContextSnapshot): ResponsePlan {
  const { review, weakestSkill, weakItems, a1 } = ctx;
  const top = weakItems.slice(0, 6);

  const contextBlock = [
    'WHAT TO PRACTISE — authoritative. Recommend in this priority order:',
    `1. Review queue: ${review.due} item(s) due now out of ${review.total}.`,
    weakestSkill
      ? `2. Weakest measured skill: ${skillName(weakestSkill.category, ctx.isDE)} at ${pct(weakestSkill.accuracy)} over ${weakestSkill.total} answers. Best drill for it: ${weakestSkill.route}`
      : '2. No skill has enough answers yet to call "weak" — suggest the current module instead.',
    top.length
      ? `3. Most-missed items: ${top.map((w) => `"${w.correctAnswer}" (${w.moduleType}, wrong ${w.errorCount}x)`).join('; ')}`
      : '3. No recurring wrong items recorded yet.',
    `Course position: module ${a1.unitIndex + 1} of ${A1_CURRICULUM.units.length}, next up: ${
      a1.pushNode ? a1.pushNode.label + ' (' + a1.pushNode.to + ')' : 'nothing outstanding'
    }.`,
  ].join('\n');

  const lines: string[] = [];
  if (review.due > 0) {
    lines.push(
      ctx.isDE
        ? `Zuerst die ${review.due} fälligen Wiederholungen — die sind zeitkritisch.`
        : `Start with the ${review.due} due review items — those are time-critical.`,
    );
  }
  if (weakestSkill) {
    lines.push(
      ctx.isDE
        ? `Deine schwächste gemessene Fähigkeit ist ${skillName(weakestSkill.category, ctx.isDE)} bei ${pct(weakestSkill.accuracy)}.`
        : `Your weakest measured skill is ${skillName(weakestSkill.category, ctx.isDE)} at ${pct(weakestSkill.accuracy)}.`,
    );
  }
  if (!lines.length) {
    lines.push(
      ctx.isDE
        ? 'Du hast noch keine messbaren Schwachstellen — mach einfach den nächsten Schritt.'
        : 'No measurable weak spots yet — just take the next step on the path.',
    );
  }

  const target =
    review.due > 0 ? `/dashboard#${ANCHORS.reviewQueue}` : (weakestSkill?.route ?? a1.pushNode?.to);

  return {
    intent: 'practice_suggestion',
    contextBlock,
    fallbackReply: lines.join(' '),
    suggestedAction: target
      ? {
          label:
            review.due > 0
              ? ctx.isDE
                ? 'Wiederholungen starten'
                : 'Start review'
              : ctx.isDE
                ? 'Übung öffnen'
                : 'Open practice',
          to: target,
        }
      : undefined,
    mood: 'teasing',
  };
}

/* ── "why was I wrong?" ───────────────────────────────────────────────────── */

export function handleExplainMistake(ctx: ContextSnapshot): ResponsePlan {
  const recent = ctx.review.recent.slice(0, 6);
  const { a1 } = ctx;

  const contextBlock = [
    'RECENT MISTAKES — authoritative. The learner is asking WHY they got one wrong.',
    recent.length
      ? recent
          .map(
            (r) =>
              `- [${r.moduleType}${r.errorTag ? '/' + r.errorTag : ''}] item "${r.itemKey}": they answered "${r.userAnswer}", correct is "${r.correctAnswer}" (missed ${r.errorCount}x)`,
          )
          .join('\n')
      : '- No mistakes are recorded in the review queue.',
    `Current module: ${a1.unitIndex + 1}. ${a1.unitTitle} (${a1.unitTitleDE})`,
    'Explain the RULE behind the answer, not just the correct form. If you are unsure of the rule, say so — do not invent one.',
  ].join('\n');

  const latest = recent[0];
  const fallbackReply = !recent.length
    ? ctx.isDE
      ? 'In deiner Wiederholungswarteschlange steht gerade nichts — du machst es gut.'
      : "Nothing in your review queue right now — you're doing fine."
    : ctx.isDE
      ? `Beim letzten Mal war die richtige Antwort "${latest?.correctAnswer}", du hattest "${latest?.userAnswer}" geschrieben.`
      : `Last time the right answer was "${latest?.correctAnswer}" and you wrote "${latest?.userAnswer}".`;

  const tagRoute = latest?.errorTag ? ERROR_TAG_ROUTE[latest.errorTag] : undefined;

  return {
    intent: 'explain_mistake',
    contextBlock,
    fallbackReply,
    // Show the actual wrong→right pair, not just describe it.
    ...(latest
      ? {
          payload: {
            kind: 'error' as const,
            itemKey: latest.itemKey,
            moduleType: latest.moduleType,
            userAnswer: latest.userAnswer,
            correctAnswer: latest.correctAnswer,
            errorCount: latest.errorCount,
            errorTag: latest.errorTag,
            route: tagRoute ?? null,
          },
        }
      : {}),
    suggestedAction: tagRoute
      ? { label: ctx.isDE ? 'Diese Übung' : 'Practise this', to: tagRoute }
      : undefined,
    mood: 'concerned',
  };
}

/* ── where am I in the course? ────────────────────────────────────────────── */

export function handleCurriculumHelp(ctx: ContextSnapshot): ResponsePlan {
  const { a1 } = ctx;
  const total = A1_CURRICULUM.units.length;
  const next = a1.pushNode;

  const contextBlock = [
    'CURRICULUM POSITION — authoritative.',
    `- The A1 spine is a LINEAR sequence of ${total} modules. The learner is on module ${a1.unitIndex + 1}: "${a1.unitTitle}" / "${a1.unitTitleDE}".`,
    `- Completed nodes: ${a1.completedCount} of ${a1.totalLearnNodes}.`,
    `- Modules unlocked up to: ${a1.unlockedUnitIndex + 1}. Checkpoints passed: ${a1.passedCheckpoints}.`,
    next
      ? `- The next step is "${next.label}" / "${next.labelDE}" at ${next.to}.`
      : '- Everything reachable is complete; the learner should review or advance the path mode.',
    'A module unlocks the next one only by passing its checkpoint at 80% or better. Retry is unlimited.',
  ].join('\n');

  const fallbackReply = next
    ? ctx.isDE
      ? `Du bist bei Modul ${a1.unitIndex + 1} (${a1.unitTitleDE}). Als Nächstes: ${next.labelDE} → ${next.to}`
      : `You're on module ${a1.unitIndex + 1} (${a1.unitTitle}). Next: ${next.label} → ${next.to}`
    : ctx.isDE
      ? `Du bist bei Modul ${a1.unitIndex + 1} (${a1.unitTitleDE}) — alles Erreichbare ist erledigt.`
      : `You're on module ${a1.unitIndex + 1} (${a1.unitTitle}) — everything reachable is done.`;

  return {
    intent: 'curriculum_help',
    contextBlock,
    fallbackReply,
    suggestedAction: next ? { label: ctx.isDE ? 'Losgehen' : 'Go', to: next.to } : undefined,
    mood: 'idle',
  };
}

/* ── grammar ──────────────────────────────────────────────────────────────── */

/**
 * Pull the REAL rule tables the current module ships, straight from the
 * curriculum JSON. This is what stops the model inventing a grammar rule:
 * it is only ever shown what the app itself teaches.
 */
function grammarGrounding(unitIndex: number, isDE: boolean): string {
  const ped = unitAt(unitIndex)?.pedagogy;
  if (!ped) return '';
  const lines: string[] = [];

  if (ped.grammarNote) lines.push(pick(ped.grammarNote, isDE));
  if (ped.ruleTable) {
    lines.push(`Rules this module teaches (${pick(ped.ruleTable.title, isDE)}):`);
    for (const row of ped.ruleTable.rows.slice(0, 8)) {
      lines.push(
        `- ${pick(row.label, isDE)}: ${pick(row.usage, isDE)} (e.g. ${pick(row.example, isDE)})`,
      );
    }
  }
  if (ped.grammarComparison) {
    lines.push(`Word order (${pick(ped.grammarComparison.title, isDE)}):`);
    for (const row of ped.grammarComparison.rows) {
      lines.push(
        `- ${pick(row.language, isDE)}: ${pick(row.order, isDE)} (e.g. ${pick(row.example, isDE)})`,
      );
    }
  }
  if (ped.suffixNote) lines.push(pick(ped.suffixNote, isDE));
  return lines.join('\n');
}

export function handleGrammarQuestion(ctx: ContextSnapshot): ResponsePlan {
  const grounded = grammarGrounding(ctx.a1.unitIndex, ctx.isDE);
  const ruleTable = unitAt(ctx.a1.unitIndex)?.pedagogy?.ruleTable;
  const contextBlock = [
    `LEARNER LEVEL: ${ctx.cefr || 'A1'} · module ${ctx.a1.unitIndex + 1} (${ctx.a1.unitTitle}).`,
    grounded
      ? `RULES FROM THIS APP'S CURRICULUM — the only rules you may assert:\n${grounded}`
      : 'This module ships no rule table. Say plainly that you are not certain rather than inventing a rule.',
    'Keep the explanation to 2-4 sentences, give one German example, and give the English meaning in one line.',
  ].join('\n');

  return {
    intent: 'grammar_question',
    contextBlock,
    fallbackReply: grounded
      ? ctx.isDE
        ? 'Dazu habe ich keine sichere Regel geladen. Die Grammatik-Seite hat die kompletten A1-Regeln — schau dort nach.'
        : "I don't have a verified rule for that one loaded. The Grammar page has the full A1 rules — check it there."
      : ctx.isDE
        ? 'Dazu habe ich keine sichere Regel geladen. Schau auf der Grammatik-Seite nach.'
        : "I don't have a verified rule for that. Check the Grammar page.",
    // The module's own rule table, rendered by the app's own table component.
    ...(ruleTable && ruleTable.rows.length
      ? { payload: { kind: 'rules' as const, title: ruleTable.title, rows: ruleTable.rows } }
      : {}),
    suggestedAction: { label: ctx.isDE ? 'Grammatik' : 'Grammar', to: '/grammar' },
    mood: 'thinking',
  };
}

/* ── in-chat practice ─────────────────────────────────────────────────────── */

export function handleStartQuiz(ctx: ContextSnapshot): ResponsePlan {
  return {
    intent: 'start_quiz',
    contextBlock: [
      'THE LEARNER ASKED TO BE QUIZZED.',
      `Weak items available: ${ctx.weakItems.length}. Review queue: ${ctx.review.total} (${ctx.review.due} due).`,
      'A drill is assembled by the app from real data and shown as interactive cards. Say one short encouraging line and stop — do NOT invent questions yourself.',
    ].join('\n'),
    fallbackReply: ctx.isDE
      ? 'Los geht’s! Tippe die richtige Antwort.'
      : "Here we go! Tap the right answer.",
    suggestedAction: undefined,
    mood: 'teasing',
  };
}

/* ── explain this page ────────────────────────────────────────────────────── */

export function handlePageHelp(
  ctx: ContextSnapshot,
  page: { label: string; facts: string[]; focus: { subject: string; detail?: string } | null } | null,
): ResponsePlan {
  const subject = page?.focus?.subject;
  return {
    intent: 'page_help',
    contextBlock: page
      ? [
          `THE LEARNER ASKED ABOUT THE PAGE THEY ARE ON.`,
          ...page.facts,
          'Answer about THIS screen specifically. If a page focus is present, explain THAT item. Be concrete, not a generic lesson.',
        ].join('\n')
      : 'THE LEARNER ASKED ABOUT THE CURRENT PAGE, but nothing specific is known about it. Say what page they appear to be on from the route and ask one clarifying question.',
    fallbackReply: subject
      ? ctx.isDE
        ? `Du schaust auf „${subject}“. Frag mich, was du wissen willst.`
        : `You're looking at "${subject}". Ask me anything about it.`
      : ctx.isDE
        ? 'Sag mir, welche Seite du meinst.'
        : 'Tell me which part of the page you mean.',
    mood: 'thinking',
  };
}

/* ── weekly report ────────────────────────────────────────────────────────── */

export function handleReport(summary: ReportSection[]): ResponsePlan {
  return {
    intent: 'report',
    contextBlock: [
      'REPORT DATA — authoritative. Quote these figures exactly, then add at most two sentences of honest commentary.',
      ...summary.map((s) => `- ${s.title}: ${s.value}`),
    ].join('\n'),
    fallbackReply: summary.map((s) => `${s.title}: ${s.value}`).join('\n'),
    payload: { kind: 'report', summary },
    mood: 'proud',
  };
}

/* ── vocabulary ───────────────────────────────────────────────────────────── */

export function handleVocabLookup(
  ctx: ContextSnapshot,
  hit: VocabHit | null,
  term: string,
): ResponsePlan {
  if (hit) {
    const contextBlock = [
      `LOOKUP RESULT for "${term}" — from the app's own vocabulary database. Use ONLY these facts:`,
      `- Lemma: ${hit.lemma}${hit.article ? ` (article: ${hit.article})` : ''}${hit.plural ? ` · plural: ${hit.plural}` : ''}`,
      `- Part of speech: ${hit.partOfSpeech} · CEFR: ${hit.cefrLevel}`,
      `- English: ${hit.en}`,
      ctx.isDE ? '' : `- Nepali: ${hit.np}`,
      hit.examples.length ? `- Example sentences: ${hit.examples.join(' / ')}` : '',
      hit.audioUrl ? '- Audio is available in the Glossary for this word.' : '',
      ctx.isDE
        ? 'Antworte auf DEUTSCH. EN/NE-Hilfen ausblenden.'
        : 'Answer in English, with the German term in bold. Mention the article if there is one.',
    ]
      .filter(Boolean)
      .join('\n');

    const fallbackReply = `${hit.article ? hit.article + ' ' : ''}${hit.lemma} = ${hit.en}${
      hit.examples.length ? ` — e.g. "${hit.examples[0]}"` : ''
    }`;

    return {
      intent: 'vocab_lookup',
      contextBlock,
      fallbackReply,
      // The real card, with the real gender badge and real audio.
      payload: { kind: 'vocab', hit },
      suggestedAction: { label: ctx.isDE ? 'Glossar' : 'Glossary', to: '/glossary' },
      mood: 'proud',
    };
  }

  return {
    intent: 'vocab_lookup',
    contextBlock: `"${term}" was NOT found in the app's vocabulary database. Say so. Do not invent a translation. Offer the Glossary as the authoritative source.`,
    fallbackReply: ctx.isDE
      ? `"${term}" steht nicht in meinem Wortschatz — ich rate nicht. Im Glossar findest du die geprüften Bedeutungen.`
      : `"${term}" isn't in my vocabulary database and I won't guess. The Glossary has the verified meanings.`,
    suggestedAction: { label: ctx.isDE ? 'Glossar öffnen' : 'Open Glossary', to: '/glossary' },
    mood: 'concerned',
  };
}

/* ── the soft stuff ───────────────────────────────────────────────────────── */

export function handleMotivation(ctx: ContextSnapshot): ResponsePlan {
  const { streak, xp, a1, review } = ctx;
  const wins: string[] = [];
  if (streak.longest > 0) wins.push(`best streak ${streak.longest} days`);
  if (xp.totalXp > 0) wins.push(`${xp.totalXp} XP at level ${xp.level}`);
  if (a1.completedCount > 0) wins.push(`${a1.completedCount} path nodes completed`);
  if (a1.passedCheckpoints > 0) wins.push(`${a1.passedCheckpoints} checkpoint(s) passed`);

  const contextBlock = [
    'THE LEARNER IS STRUGGLING. This is the one place to drop the teasing entirely.',
    `- Streak: ${streak.current} day(s) current, best ${streak.longest}.`,
    wins.length
      ? `- Real achievements to acknowledge: ${wins.join('; ')}.`
      : '- No achievements recorded yet.',
    `- Next concrete step: ${
      a1.pushNode ? a1.pushNode.label + ' (' + a1.pushNode.to + ')' : 'a quick review'
    }.`,
    `- ${review.due} review item(s) are due — a 2-minute batch is the smallest possible win.`,
    'Do NOT use catchphrases, do NOT tease, and do NOT invent progress. Acknowledge the feeling, name one real thing they have done, then offer a task small enough to start right now.',
  ].join('\n');

  const fallbackReply = ctx.isDE
    ? 'Kein Stress — Lernen ist zäh. Fangen wir mit etwas Kleinem an: eine einzige Wiederholung, zwei Minuten.'
    : "No stress — this is hard. Let's start tiny: one review batch, two minutes.";

  return {
    intent: 'motivation',
    contextBlock,
    fallbackReply,
    suggestedAction:
      review.due > 0
        ? {
            label: ctx.isDE ? '2 Minuten Review' : '2-minute review',
            to: `/dashboard#${ANCHORS.reviewQueue}`,
          }
        : a1.pushNode
          ? { label: ctx.isDE ? 'Weiter' : 'Continue', to: a1.pushNode.to }
          : undefined,
    mood: 'happy',
  };
}

export function handleSettings(ctx: ContextSnapshot): ResponsePlan {
  return {
    intent: 'settings',
    contextBlock: [
      "THE LEARNER IS ASKING ABOUT THE COMPANION'S OWN SETTINGS (model, server, tone).",
      'Explain: the companion runs entirely on THEIR OWN machine via Ollama or LM Studio.',
      'The URL and model are configured in Settings — that is the only thing needed.',
      'Do not claim any setting is stored on a server. There is no server.',
    ].join('\n'),
    fallbackReply: ctx.isDE
      ? 'Alles über mich stellst du in den Einstellungen ein: Server-URL, Modell und wie neckisch ich sein darf. Ich laufe komplett auf deinem Rechner.'
      : 'Everything about me lives in Settings: server URL, model, and how cheeky I am allowed to be. I run entirely on your own machine.',
    suggestedAction: { label: ctx.isDE ? 'Einstellungen' : 'Settings', to: '/settings' },
    mood: 'idle',
  };
}

export function handleConversation(
  ctx: ContextSnapshot,
  conversation?: ConversationState,
): ResponsePlan {
  // `levelForContext` is the single source of truth for the sub-level.
  const level = conversation?.userLevel ?? levelForContext(ctx.cefr, ctx.a1.unitIndex);
  const topic = conversation?.topic;

  const contextBlock = [
    'GERMAN CONVERSATION PRACTICE. Reply in German, then one short English gloss.',
    `Learner sub-level: ${level}. Current module: ${ctx.a1.unitIndex + 1} — ${ctx.a1.unitTitle} (${ctx.a1.unitTitleDE}).`,
    topic
      ? `The conversation is about "${topic}".`
      : 'No topic yet — open with one easy, concrete question.',
    'Keep it to 1-2 short sentences and end with ONE question so the learner has to answer. Never correct them mid-flow; if you correct anything, correct at most one thing, briefly, at the very end.',
  ].join('\n');

  return {
    intent: 'conversation',
    contextBlock,
    fallbackReply: 'Hallo! Wie geht es dir? — Hello! How are you?',
    mood: 'happy',
  };
}

export function handleCasualChat(ctx: ContextSnapshot): ResponsePlan {
  const name = ctx.userName ? `, ${ctx.userName}` : '';
  return {
    intent: 'casual_chat',
    contextBlock: [
      'CASUAL CHAT. Keep it to one or two sentences, then steer toward something useful.',
      `Learner is on module ${ctx.a1.unitIndex + 1} (${ctx.a1.unitTitle}) at ${ctx.cefr || 'A1'}.`,
      'You may ask what they want to work on. Do not lecture.',
    ].join('\n'),
    fallbackReply: ctx.isDE
      ? `Hallo${name}! Ich bin Mero, deine Eule. Frag mich nach Grammatik, Wortschatz oder deinem Fortschritt.`
      : `Hi${name}! I'm Mero, your owl. Ask me about grammar, vocabulary, or how your progress is going.`,
    mood: 'idle',
  };
}

/* ── dispatcher ───────────────────────────────────────────────────────────── */

/** Mood used when a handler does not set one itself. */
const DEFAULT_MOOD: Record<Intent, MeroMood> = {
  explain_mistake: 'concerned',
  practice_suggestion: 'teasing',
  vocab_lookup: 'proud',
  grammar_question: 'thinking',
  progress_check: 'proud',
  curriculum_help: 'idle',
  motivation: 'happy',
  settings: 'idle',
  start_quiz: 'teasing',
  page_help: 'thinking',
  report: 'proud',
  conversation: 'happy',
  casual_chat: 'idle',
};

/**
 * Route an intent to its handler — the only entry point the chat UI calls.
 *
 * Term extraction is delegated to `intentRouter.extractQuotedTerm` so
 * "what does X mean?" is parsed in exactly one place, and the default mood map
 * means no handler can forget to set one.
 */
export function handleIntent(input: HandleInput): ResponsePlan {
  const { intent, message, context, vocabHit, conversation, page, report } = input;
  switch (intent) {
    case 'progress_check':
      return handleProgressCheck(context);
    case 'practice_suggestion':
      return handlePracticeSuggestion(context);
    case 'explain_mistake':
      return handleExplainMistake(context);
    case 'curriculum_help':
      return handleCurriculumHelp(context);
    case 'grammar_question':
      return handleGrammarQuestion(context);
    case 'start_quiz':
      return handleStartQuiz(context);
    case 'page_help':
      return handlePageHelp(context, page ?? null);
    case 'report':
      return handleReport(report ?? []);
    case 'vocab_lookup':
      return handleVocabLookup(
        context,
        vocabHit ?? null,
        extractQuotedTerm(message) ?? message.trim(),
      );
    case 'motivation':
      return handleMotivation(context);
    case 'settings':
      return handleSettings(context);
    case 'conversation':
      return handleConversation(context, conversation);
    case 'casual_chat':
    default:
      return { ...handleCasualChat(context), mood: DEFAULT_MOOD.casual_chat };
  }
}

/**
 * Two or three follow-up questions derived from what was JUST answered.
 *
 * The empty-state chips are fixed, so a learner who asks one question and stops
 * has nowhere to go next. These are computed from the intent we already
 * resolved, so they cost nothing and always continue the actual thread rather
 * than restarting a generic menu.
 */
export function followUpsFor(intent: Intent, isDE: boolean): string[] {
  switch (intent) {
    case 'explain_mistake':
      return isDE
        ? ['Gib mir ein Beispiel', 'Welche Regel gilt?', 'Lass mich nochmal raten']
        : ['Give me an example', 'Which rule applies?', 'Let me try that again'];
    case 'vocab_lookup':
      return isDE
        ? ['Wie sagt man das?', 'Gib mir einen Beispielsatz', 'Und der Plural?']
        : ['How do you say it?', 'Give me an example sentence', "What's the plural?"];
    case 'progress_check':
      return isDE ? ['Was sollte ich üben?', 'Wo bin ich im Kurs?'] : ['What should I practise?', 'Where am I in the course?'];
    case 'curriculum_help':
      return isDE ? ['Was sollte ich üben?', 'Wie weit bin ich?'] : ['What should I practise?', 'How am I doing?'];
    case 'practice_suggestion':
      return isDE ? ['Die Übung starten', 'Erklär mir die Regel'] : ['Let us start that drill', 'Explain the rule to me'];
    case 'grammar_question':
      return isDE
        ? ['Gib mir ein Beispiel', 'Wie heißt das auf Deutsch?']
        : ['Give me an example', 'What is that in German?'];
    case 'motivation':
      return isDE ? ['Zeig mir einen kleinen Schritt', 'Wie weit bin ich?'] : ['Show me one small step', 'How am I doing?'];
    case 'conversation':
      return isDE
        ? ['Noch eine Frage auf Deutsch', 'Habe ich das richtig gesagt?']
        : ['Another question in German', 'Am I saying it right?'];
    case 'settings':
      return isDE ? ['Wie weit bin ich?'] : ['How am I doing?'];
    case 'start_quiz':
      return isDE
        ? ['Noch eine Runde', 'Was sollte ich üben?']
        : ['One more round', 'What should I practise?'];
    case 'page_help':
      return isDE
        ? ['Gib mir ein Beispiel', 'Was bedeutet das?']
        : ['Give me an example', 'What does that mean?'];
    case 'report':
      return isDE
        ? ['Was sollte ich üben?', 'Wo bin ich im Kurs?']
        : ['What should I practise?', 'Where am I in the course?'];
    case 'casual_chat':
    default:
      return isDE ? ['Was sollte ich üben?', 'Wo bin ich im Kurs?'] : ['What should I practise?', 'Where am I in the course?'];
  }
}
