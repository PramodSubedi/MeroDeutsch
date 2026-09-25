import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { SEO } from '../components/common/SEO';
import { curriculumService } from '../services';
import { MessagingRoleplay } from '../components/exercises/MessagingRoleplay';
import { buildConversationalScenarios, buildTemplateRoleplayScenarios } from '../utils/conversationalToRoleplay';
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
  const [dbLoading, setDbLoading] = useState(true);
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

      const templateFallback = defs.length > 0 && vocab.length > 0
        ? { defs, vocab }
        : { defs: fallbackDefs.length > 0 ? fallbackDefs : [], vocab: fallbackVocab.length > 0 ? fallbackVocab : [] };

      setSource(
        defs.length > 0 && vocab.length > 0
          ? { defs, vocab }
          : templateFallback,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!source) return;
    try {
      const generated = source.defs.length > 0 && source.vocab.length > 0
        ? buildConversationalScenarios(source.defs, source.vocab)
        : buildTemplateRoleplayScenarios();
      setConversations(generated);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getRoleplayScenarios()
      .then((s) => {
        if (!cancelled) {
          setDbScenarios(s);
          setDbLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDbScenarios([]);
          setDbLoading(false);
        }
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
    return [...s].sort((a, b) => a.localeCompare(b));
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

  const duplicateTitles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scenario of pickerScenarios) {
      const key = scenario.title.trim().toLocaleLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [pickerScenarios]);

  const showLoading = loading || (allScenarios.length === 0 && dbLoading);

  const levelLabel = (band?: string) => (band ?? '').trim() || 'A1';
  const levelBadgeClass = (band?: string) => {
    const b = (band ?? '').toUpperCase();
    if (b.includes('B1')) return 'bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300';
    if (b.includes('A2')) return 'bg-accent-100 text-accent-800 dark:bg-accent-950/40 dark:text-accent-300';
    return 'bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-300';
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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200/80 pb-5 dark:border-ink-800">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-500">
              {isDE ? 'Gesprächstraining' : 'Conversation practice'}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-950 dark:text-white">
              {isDE ? 'Dialoge' : 'Roleplay'}
            </h1>
            <p className="mt-1 max-w-xl text-body leading-6 text-ink-600 dark:text-ink-400">
              {isDE
                ? 'Wähl eine Alltagssituation und übe das Gespräch.'
                : 'Choose a real situation and practice saying the next thing.'}
            </p>
          </div>
        </div>
        {!showLoading && allScenarios.length > 0 && (
          <div className="pb-1 text-meta font-semibold text-ink-500 dark:text-ink-400" aria-live="polite">
            {isDE ? `${pickerScenarios.length} Gespräche` : `${pickerScenarios.length} scenarios`}
          </div>
        )}
      </header>
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
      ) : showLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="status" aria-label={isDE ? 'Dialoge werden geladen' : 'Loading scenarios'}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex min-h-[92px] items-center gap-3 rounded-sm border border-ink-200/80 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-sm bg-ink-100 dark:bg-ink-800" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="block h-4 w-2/3 animate-pulse rounded-sm bg-ink-100 dark:bg-ink-800" />
                <span className="block h-3 w-1/3 animate-pulse rounded-sm bg-ink-100 dark:bg-ink-800" />
              </span>
            </div>
          ))}
        </div>
      ) : allScenarios.length === 0 ? (
        <div className={`${theme.panel.muted} min-h-[120px] pb-4 text-body`}>
          {isDE
            ? 'Noch keine Szenarien verfügbar — verbinde dich einmal mit dem Internet.'
            : 'No conversations available yet — go online once to load them.'}
        </div>
      ) : (
        <div className="mt-6">
          {availableLevels.length > 1 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-sm border border-ink-200 bg-white p-1 shadow-sm dark:border-ink-800 dark:bg-ink-900" role="group" aria-label={isDE ? 'Nach Niveau filtern' : 'Filter by level'}>
              {(['all', ...availableLevels] as const).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevelFilter(lv)}
                  aria-pressed={levelFilter === lv}
                  className={`min-h-9 rounded-sm px-3 text-meta font-bold transition active:scale-[0.98] ${
                    levelFilter === lv
                      ? 'bg-accent-600 text-white shadow-sm dark:bg-accent-500 dark:text-white'
                      : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                  }`}
                >
                  {lv === 'all' ? (isDE ? 'Alle' : 'All') : lv}
                  <span className={`ml-1.5 text-[10px] ${levelFilter === lv ? 'text-white/65 dark:text-[#1b261c]/65' : 'text-ink-500 dark:text-ink-500'}`}>
                    {lv === 'all' ? pickerScenarios.length : pickerScenarios.filter((scenario) => (scenario.level ?? '').toUpperCase().includes(lv)).length}
                  </span>
                </button>
              ))}
              </div>
              <span className="text-meta font-medium text-ink-500 dark:text-ink-400">
                {isDE ? 'Nach Niveau auswählen' : 'Choose your level'}
              </span>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pickerScenarios.map((sc) => {
              const canSwap = swapBaseIds.has(sc.id);
              const titleKey = sc.title.trim().toLocaleLowerCase();
              const displayTitle = (duplicateTitles.get(titleKey) ?? 0) > 1
                ? `${sc.title} · ${levelLabel(sc.level)}`
                : sc.title;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handlePick(sc)}
                  className="group flex min-h-[72px] min-w-0 items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-accent-300 hover:bg-accent-50/40 active:scale-95 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-accent-400 dark:hover:bg-accent-950/30"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-ink-100 text-2xl dark:bg-ink-800" aria-hidden="true">{sc.emoji || '💬'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-ink-950 dark:text-white">
                      {displayTitle}
                    </span>
                    <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelBadgeClass(sc.level)}`}>
                        {levelLabel(sc.level)}
                      </span>
                      <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                        {sc.steps.length} {isDE ? 'Schritte' : 'steps'}
                      </span>
                      {canSwap && (
                        <span
                          className="inline-block rounded-full bg-[#eef7d5] px-2 py-0.5 text-[11px] font-semibold text-[#526d21] dark:bg-[#283720] dark:text-[#d8f477]"
                          title={isDE ? 'Rollenwechsel verfügbar' : 'Role swap available'}
                        >
                          🎭 {isDE ? 'Rollenwechsel' : 'Role swap'}
                        </span>
                      )}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-500 transition group-hover:translate-x-0.5 group-hover:text-[#526d21] dark:text-ink-500 dark:group-hover:text-[#d8f477]" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {pickerScenarios.length === 0 && (
            <div className={`${theme.panel.muted} mb-4 text-body`}>
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