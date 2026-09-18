import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useAuth } from '../../hooks/useAuth';
import { useCefrLevel } from '../../hooks/useCefrLevel';
import { curriculumService } from '../../services';
import { speakWord } from '../../hooks/useSpeech';
import { DailyQuestsWidget } from '../DailyQuestsWidget';
import { theme } from '../../config/theme';
import { pickWordOfDay } from '../../utils/wordOfDay';
import type { VocabCard } from '../../types';

/**
 * HomeExtras - logged-in extras mounted on Home below the main layout.
 *
 * 1. Continue card: deep-links to the vocab trainer seeded with the user's
 *    CEFR level (A1/A2/B1/B2) via the ?level= query param (logged-in only).
 * 2. Word of the day: deterministic day-based pick from the vocabulary deck,
 *    with TTS. Guest-safe (works without auth).
 * 3. Daily quests: the existing XP-linked quest widget (practice a lesson,
 *    use tools, review ...) with tick marks on completed quests.
 *
 * WOD data source: `getVocabularyFiltered({ limit: 2000 })`, which routes to
 * the word-ordered `get_vocabulary_glossary` RPC (migration 017) — a STABLE,
 * non-randomized pool. Indexing it via `pickWordOfDay` yields the same word
 * per local day across refreshes and matches DailyChallenge's pick. (Using
 * `{}` here previously hit the random quiz RPC and also read VocabCard fields
 * that do not exist — `de` instead of `lemma` — so the card never rendered.)
 */
export function HomeExtras() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const auth = useAuth() as { isAuthenticated?: boolean };
  const isAuthenticated = Boolean(auth?.isAuthenticated);
  const cefrState = useCefrLevel() as unknown as { level?: string } | string | undefined;
  const cefrLevel = typeof cefrState === 'string' ? cefrState : (cefrState?.level ?? 'A1');

  const [wod, setWod] =
    useState<{ lemma: string; en: string; ne: string; article: VocabCard['article'] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getVocabularyFiltered({ limit: 2000 })
      .then((cards) => {
        if (cancelled || !cards || cards.length === 0) return;
        // Deduplicate by lemma so duplicate DB rows can't surface two words.
        const byLemma = new Map<string, (typeof cards)[number]>();
        for (const c of cards) {
          const k = (c.lemma ?? '').trim().toLowerCase();
          if (k && !byLemma.has(k)) byLemma.set(k, c);
        }
        const pool = [...byLemma.values()];
        const pick = pickWordOfDay(pool, (c) => c.id ?? c.lemma);
        if (pick) {
          setWod({
            lemma: pick.lemma,
            en: pick.translation?.en ?? '',
            ne: pick.translation?.np ?? '',
            article: pick.article ?? null,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {isAuthenticated && (
          <Link
            to={`/vocab-trainer?level=${cefrLevel}`}
            className={`${theme.panel.surface} group flex min-h-[64px] items-center justify-between gap-3 py-4 transition hover:shadow-md active:scale-[0.99]`}
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isDE ? 'Weiter lernen' : 'Continue German'}
              </span>
              <span className="mt-1 block text-lg font-bold text-slate-950 dark:text-white">
                {cefrLevel} {isDE ? 'Wortschatz' : 'Vocabulary'}
              </span>
            </span>
            <span className="text-blue-600 transition group-hover:translate-x-0.5 dark:text-blue-300" aria-hidden="true">
              {'\u2192'}
            </span>
          </Link>
        )}
        {wod && (
          <div className={`${theme.panel.surface} flex min-h-[64px] items-center justify-between gap-3 py-4`}>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isDE ? 'Wort des Tages' : 'Word of the day'}
              </div>
              <div className="mt-1 flex items-baseline gap-2 truncate">
                  {wod.article === 'der' ? (
                    <span className={`truncate text-lg font-bold ${theme.gender.der.text} ${theme.gender.der.darkText}`}>
                      {wod.article}
                    </span>
                  ) : wod.article === 'die' ? (
                    <span className={`truncate text-lg font-bold ${theme.gender.dieF.text} ${theme.gender.dieF.darkText}`}>
                      {wod.article}
                    </span>
                  ) : wod.article === 'das' ? (
                    <span className={`truncate text-lg font-bold ${theme.gender.das.text} ${theme.gender.das.darkText}`}>
                      {wod.article}
                    </span>
                  ) : null}
                  <span className="truncate text-lg font-bold text-slate-950 dark:text-white">{wod.lemma}</span>
                </div>
              {!isDE && (wod.en || wod.ne) && (
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {[wod.en, wod.ne].filter(Boolean).join(' \u00b7 ')}
                </div>
              )}
            </div>
            <button
              type="button"
                            onClick={() => speakWord(wod.lemma)}
              className={theme.button.icon}
                            aria-label={`Speak ${wod.lemma}`}
            >
              {'\u{1F50A}'}
            </button>
          </div>
        )}
      </div>
      <DailyQuestsWidget />
    </div>
  );
}
