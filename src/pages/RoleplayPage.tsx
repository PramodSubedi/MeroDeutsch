import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { SEO } from '../components/common/SEO';
import { PageHeading } from '../components/common/PageHeading';
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
import convStaffTwinsJson from '../data/roleplay_staff_twins.json';
import lifeStaffTwinsJson from '../data/roleplay_life_staff_twins.json';

type ConvSource = { defs: ConversationScenarioSeed[]; vocab: ConversationVocab[] };

/**
 * Roleplay — branching dialogue practice.
 * PICKER-FIRST: pick ONE scenario, then the chat loads. Staff `-staff` twins
 * are NOT separate cards (no double cards); a 🎭 badge marks swap-able topics
 * and the swap happens inside the chat via its variant chips.
 */
export function RoleplayPage() {
  usePageTitle('Roleplay');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [dbScenarios, setDbScenarios] = useState<RoleplayScenario[]>([]);
  const [source, setSource] = useState<ConvSource | null>(null);
  const [conversations, setConversations] = useState<RoleplayScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<'all' | 'A1' | 'A2' | 'B1'>('all');
  const [activeScenario, setActiveScenario] = useState<RoleplayScenario | null>(null);
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
        // fall through to bundled fallback
      }
      if (cancelled) return;
      const fallbackDefs = [
        ...(scenarioDefsJson as unknown as ConversationScenarioSeed[]),
        ...((lifeDefsJson as unknown) as ConversationScenarioSeed[]),
        // Staff role-swap twin scenarios — swap happens inside the chat.
        ...((convStaffTwinsJson as unknown) as ConversationScenarioSeed[]),
        ...((lifeStaffTwinsJson as unknown) as ConversationScenarioSeed[]),
      ];
      const fallbackVocab = [
        ...(vocabBankJson as unknown as ConversationVocab[]),
        ...((lifeVocabJson as unknown) as ConversationVocab[]),
      ];
      setSource(
        defs.length > 0 && vocab.length > 0
          ? { defs, vocab }
          : { defs: fallbackDefs, vocab: fallbackVocab },
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!source) return;
    setConversations(buildConversationalScenarios(source.defs, source.vocab));
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getRoleplayScenarios()
      .then((s) => {
        if (!cancelled) setDbScenarios(s);
      })
      .catch(() => {
        if (!cancelled) setDbScenarios([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  const allScenarios = useMemo(() => {
    const convTitles = new Set(conversations.map((s) => s.title));
    const db = dbScenarios.filter((s) => !convTitles.has(s.title));
    return [...conversations, ...db];
  }, [conversations, dbScenarios]);

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
    return allScenarios.filter((sc) =>
      (sc.level ?? '').toUpperCase().includes(levelFilter),
    );
  }, [allScenarios, levelFilter]);

  // Base ids that HAVE a staff twin (for the 🎭 badge).
  const swapBaseIds = useMemo(
    () =>
      new Set(
        allScenarios
          .filter((s) => s.id.endsWith('-staff'))
          .map((s) => s.id.replace(/-staff$/, '')),
      ),
    [allScenarios],
  );

  // Picker cards: hide `-staff` twins so each topic appears once (no doubles).
  const pickerScenarios = useMemo(
    () => filtered.filter((sc) => !sc.id.endsWith('-staff')),
    [filtered],
  );

  const levelLabel = (band?: string) => (band ?? '').trim() || 'A1';
  const levelBadgeClass = (band?: string) => {
    const b = (band ?? '').toUpperCase();
    if (b.includes('B1')) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    if (b.includes('A2')) return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
  };

  const handlePick = (sc: RoleplayScenario) => setActiveScenario(sc);
  const handleBack = () => setActiveScenario(null);

  // Swap pair for the chat: active base + its `-staff` twin (if present).
  const swapPair = useMemo(() => {
    if (!activeScenario) return [];
    const inv = activeScenario.id.endsWith('-staff')
      ? activeScenario.id.replace(/-staff$/, '')
      : `${activeScenario.id}-staff`;
    return allScenarios.filter((sc) => sc.id === activeScenario.id || sc.id === inv).slice(0, 2);
  }, [activeScenario, allScenarios]);
return (
    <div className={theme.page.container}>
      <PageHeading
        title={isDE ? 'Dialoge' : 'Roleplay'}
        subtitle={
          isDE
            ? 'Wähl eine Alltagssituation und übe das Gespräch.'
            : 'Pick a real-world situation and practice the dialogue.'
        }
      />
      <SEO
        title="Roleplay German Dialogs | MeroDeutsch"
        description="Practice real-world German conversations. Role-flip scenarios let you play the staff side too."
      />

      {activeScenario ? (
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={handleBack}
            className={`${theme.button.secondary} mb-4 min-h-[44px] active:scale-95`}
          >
            ← {isDE ? 'Zurück zur Auswahl' : 'Back to scenarios'}
          </button>
          {swapPair.length === 0 ? (
            <MessagingRoleplay scenarios={[activeScenario]} module="roleplay" />
          ) : (
            <MessagingRoleplay key={activeScenario.id} scenarios={swapPair} module="roleplay" />
          )}
        </div>
      ) : loading || (source !== null && conversations.length === 0 && dbScenarios.length === 0) ? (
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

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pickerScenarios.map((sc) => {
              const canSwap = swapBaseIds.has(sc.id);
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handlePick(sc)}
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
                      {canSwap && (
                        <span
                          className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-200"
                          title={isDE ? 'Rollenwechsel verfügbar' : 'Role swap available'}
                        >
                          🎭 {isDE ? 'Rollenwechsel' : 'Role swap'}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600">
                    →
                  </span>
                </button>
              );
            })}
          </div>

          {pickerScenarios.length === 0 && (
            <div className={`${theme.panel.muted} mb-4 text-sm`}>
              {isDE
                ? 'Für diese Stufe gibt es noch keine Gespräche.'
                : 'No conversations at this level yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}