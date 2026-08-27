/**
 * Roleplay — branching dialogue practice rendered as a simulated messaging
 * app via the `MessagingRoleplay` Lesson Engine primitive.
 *
 * v0.2.5 slice: conversational roleplay content now lives in the `content_items`
 * pools (`conversation-def` + `conversation-vocab`). The page PREFERS the
 * database source via curriculumService (with the Dexie offline cache), and
 * falls back to the bundled JSON files on first-run/pre-seed.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { MessagingRoleplay } from '../components/exercises/MessagingRoleplay';
import { buildConversationalScenarios } from '../utils/conversationalToRoleplay';
import type {
  RoleplayScenario,
  ConversationScenarioSeed,
  ConversationVocab,
} from '../types/curriculum';
import scenarioDefsJson from '../data/conversational_scenario_defs.json';
import vocabBankJson from '../data/conversational_german_vocab.json';
import lifeDefsJson from '../data/life_scenes_defs.json';
import lifeVocabJson from '../data/life_scenes_vocab.json';

type ConvSource = { defs: ConversationScenarioSeed[]; vocab: ConversationVocab[] };

export function RoleplayPage() {
  usePageTitle('Roleplay');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // Basic DB pool (public `roleplay-scenario` pool).
  const [dbScenarios, setDbScenarios] = useState<RoleplayScenario[]>([]);
  // Conversational source: DB-first, bundled JSON fallback.
  const [source, setSource] = useState<ConvSource | null>(null);
  // Built-from-source conversations (one random variant per scenario).
  const [conversations, setConversations] = useState<RoleplayScenario[]>([]);
  const [loading, setLoading] = useState(true);
  // Incremented by the shuffle button → re-picks one variant per scenario.
  const [round, setRound] = useState(0);
  // CEFR filter: 'all' | 'A1' | 'A2' | 'B1'.
  const [levelFilter, setLevelFilter] = useState<'all' | 'A1' | 'A2' | 'B1'>('all');

  /** Resolve the conversational source: DB pools first, bundled JSON fallback. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let defs: ConversationScenarioSeed[] = [];
      let vocab: ConversationVocab[] = [];
      try {
        [defs, vocab] = await Promise.all([
          curriculumService.getConversationDefs(),
          curriculumService.getConversationVocab(),
        ]);
      } catch {
        // service failure → fall through to bundled fallback
      }
      if (cancelled) return;
      // Fallback = old conversational pack + the v0.3 life-scenes pack merged,
      // so an offline cold start still sees every bundled conversation.
      const fallbackDefs = [
        ...(scenarioDefsJson as unknown as ConversationScenarioSeed[]),
        ...((lifeDefsJson as unknown) as ConversationScenarioSeed[]),
      ];
      const fallbackVocab = [
        ...(vocabBankJson as unknown as ConversationVocab[]),
        ...((lifeVocabJson as unknown) as ConversationVocab[]),
      ];
      setSource(
        defs.length > 0 && vocab.length > 0
          ? { defs, vocab }
          : { defs: fallbackDefs, vocab: fallbackVocab }
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rebuild conversations whenever the source or round changes.
  useEffect(() => {
    if (!source) return;
    setConversations(buildConversationalScenarios(source.defs, source.vocab));
  }, [source, round]);

  // The basic (non-conversational) DB scenario pool, if any.
  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getRoleplayScenarios()
      .then((s) => { if (!cancelled) setDbScenarios(s); })
      .catch(() => { if (!cancelled) setDbScenarios([]); });
    return () => { cancelled = true; };
  }, []);

  /** Shuffle synchronously so the new key + data land in ONE commit. */
  const reshuffle = () => setRound((r) => r + 1);

  // Conversational scenarios FIRST so async DB results never shift indices.
  // DB pool scenarios whose title is already covered are superseded (dedupe).
  const allScenarios = useMemo(() => {
    const convTitles = new Set(conversations.map((s) => s.title));
    const db = dbScenarios.filter((s) => !convTitles.has(s.title));
    return [...conversations, ...db];
  }, [conversations, dbScenarios]);

  // CEFR filter chips derive from the levels actually present.
  const availableLevels = useMemo(() => {
    const s = new Set<'A1' | 'A2' | 'B1'>();
    allScenarios.forEach((sc) => {
      const b = (sc.level ?? '').toUpperCase();
      if (/A1/.test(b)) s.add('A1');
      if (/A2/.test(b)) s.add('A2');
      if (/B1/.test(b)) s.add('B1');
    });
    return [...s];
  }, [allScenarios]);

  const filtered = useMemo(() => {
    if (levelFilter === 'all') return allScenarios;
    return allScenarios.filter((sc) => (sc.level ?? '').toUpperCase().includes(levelFilter));
  }, [allScenarios, levelFilter]);

  /** Determine a clean "A1 / A2 / B1" label from a band string. */
  const levelLabel = (band?: string) => (band ?? '').trim() || 'A1';

  const levelBadgeClass = (band?: string) => {
    const b = (band ?? '').toUpperCase();
    if (b.includes('B1')) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    if (b.includes('A2')) return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
  };
return (
    <div className={theme.page.container}>
      {loading || (source !== null && conversations.length === 0 && dbScenarios.length === 0) ? (
        <div className={`${theme.panel.muted} flex min-h-[160px] items-center justify-center text-sm`}>
          {isDE ? 'Szenarien werden geladen…' : 'Loading conversations…'}
        </div>
      ) : allScenarios.length === 0 ? (
        <div className={`${theme.panel.muted} min-h-[120px] pb-4 text-sm`}>
          {isDE
            ? 'Noch keine Szenarien verfügbar — verbinde dich einmal mit dem Internet.'
            : 'No conversations available yet — go online once to load them.'}
        </div>
      ) : (
        <div className="mt-6">
          {/* CEFR filter pills */}
          {availableLevels.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(['all', ...availableLevels] as const).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevelFilter(lv)}
                  aria-pressed={levelFilter === lv}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
                    levelFilter === lv
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {lv === 'all' ? (isDE ? 'Alle' : 'All') : lv}
                </button>
              ))}
            </div>
          )}

          {/* Scenario picker — cards with emoji, title, level badge */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={reshuffle}
                className="group flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-400 dark:hover:bg-blue-950/30"
              >
                <span className="text-2xl" aria-hidden="true">{sc.emoji || '💬'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-white">
                    {sc.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelBadgeClass(sc.level)}`}>
                      {levelLabel(sc.level)}
                    </span>
                    {sc.roleFlip && (
                      <span
                        className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-200"
                        title={isDE ? 'Rollenwechsel — du spielst die Servicekraft' : 'Role flip — you play the staff'}
                      >
                        🎭 {isDE ? 'Rollenwechsel' : 'Role flip'}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600">
                  →
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className={`${theme.panel.muted} mb-4 text-sm`}>
              {isDE
                ? 'Für diese Stufe gibt es noch keine Gespräche.'
                : 'No conversations at this level yet.'}
            </div>
          ) : (
            <div className="mx-auto max-w-xl">
              {/* Shuffle: re-picks one random dialogue variant per scenario. */}
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={reshuffle}
                  className={`${theme.button.secondary} min-h-[44px] active:scale-95`}
                >
                  {isDE ? 'Neues Gespräch 🔄' : 'Next conversation 🔄'}
                </button>
              </div>
              <MessagingRoleplay key={round} scenarios={filtered} module="roleplay" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
