import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useAuth } from '../../hooks/useAuth';
import { useCefrLevel } from '../../hooks/useCefrLevel';
import { curriculumService } from '../../services';
import { speakWord } from '../../hooks/useSpeech';
import { DailyQuestsWidget } from '../DailyQuestsWidget';
import { theme } from '../../config/theme';

/**
 * HomeExtras - logged-in extras mounted on Home below the main layout.
 *
 * 1. Continue card: deep-links to the vocab trainer seeded with the user's
 *    CEFR level (A1/A2/B1/B2) via the ?level= query param (logged-in only).
 * 2. Word of the day: deterministic day-based pick from the vocabulary deck,
 *    with TTS. Guest-safe (works without auth).
 * 3. Daily quests: the existing XP-linked quest widget (practice a lesson,
 *    use tools, review ...) with tick marks on completed quests.
 */
export function HomeExtras() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const auth = useAuth() as { isAuthenticated?: boolean };
  const isAuthenticated = Boolean(auth?.isAuthenticated);
  const cefrState = useCefrLevel() as unknown as { level?: string } | string | undefined;
  const cefrLevel = typeof cefrState === 'string' ? cefrState : (cefrState?.level ?? 'A1');

  const [wod, setWod] = useState<{ de: string; en: string; ne: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getVocabularyFiltered({})
      .then((items) => {
        if (cancelled || !items || items.length === 0) return;
        const dayIndex = Math.floor(Date.now() / 86400000);
        const pick = items[dayIndex % items.length] as { de?: string; en?: string; ne?: string };
        if (pick?.de) setWod({ de: pick.de, en: pick.en ?? '', ne: pick.ne ?? '' });
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
              <div className="mt-1 truncate text-lg font-bold text-slate-950 dark:text-white">{wod.de}</div>
              {!isDE && (wod.en || wod.ne) && (
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {[wod.en, wod.ne].filter(Boolean).join(' \u00b7 ')}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => speakWord(wod.de)}
              className={theme.button.icon}
              aria-label={`Speak ${wod.de}`}
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
