import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookText, Check, RefreshCw, Layout, Globe, GitBranch, Shuffle, Scale, Split } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAnswerReporter } from '../hooks/useExerciseSession';
import { TabGroup } from '../components/TabGroup';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { GrammarDrill } from '../types/curriculum';
import { A1_INSEPARABLE_PREFIXES } from '../data/a1Verbs';
import { GrammarFlowchart, NOMINATIVE_ACCUSATIVE_FLOW } from '../components/exercises/GrammarFlowchart';

const CASES = [
  { label: 'Nominativ', de: 'Wer? (subject)', en: 'The subject of the sentence' },
  { label: 'Akkusativ', de: 'Wen? (direct object)', en: 'The direct object' },
] as const;

export function GrammarPage() {
  usePageTitle('Grammar');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // Lesson Engine integration: XP + SRS reporting via the shared reporter.
  const reportResult = useAnswerReporter();
  // ?tab= deep-link support — /learn spine bonus chips link here with
  // ?tab=modals / ?tab=stem. Unknown params fall back to the first tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const GRAMMAR_TABS = ['sein', 'haben', 'weakVerb', 'stem', 'modals', 'prefix', 'cases', 'accusative', 'bridge'] as const;
  type GrammarTab = (typeof GRAMMAR_TABS)[number];
  const paramTab = searchParams.get('tab');
  const [tab, setTabState] = useState<GrammarTab>(
    (GRAMMAR_TABS as readonly string[]).includes(paramTab ?? '')
      ? (paramTab as GrammarTab)
      : 'sein'
  );
  const setTab = (next: string) => {
    const safe = ((GRAMMAR_TABS as readonly string[]).includes(next) ? next : 'sein') as GrammarTab;
    setTabState(safe);
    setSearchParams(safe === 'sein' ? {} : { tab: safe }, { replace: true });
  };
  const [answersByTab, setAnswersByTab] = useState<Record<string, Record<number, string>>>({});
  const answers = answersByTab[tab] ?? {};

  const [drills, setDrills] = useState<GrammarDrill[]>([]);
  const [drillsLoading, setDrillsLoading] = useState(false);
  const [drillsFailed, setDrillsFailed] = useState(false);
  const [reloadDrills, setReloadDrills] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDrillsFailed(false);
    if (tab === 'bridge' || tab === 'accusative') {
      setDrills([]);
      setDrillsLoading(false);
    } else {
      setDrillsLoading(true);
      curriculumService.getGrammarDrills(tab)
        .then((data) => {
          if (!cancelled) setDrills(data);
        })
        .catch(() => {
          if (!cancelled) {
            setDrills([]);
            setDrillsFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setDrillsLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [tab, reloadDrills]);

  const count = Object.keys(answers).length;
  const allDone = count === drills.length;
  const score = drills.filter((d, i) => answers[i] === d.correct).length;

  const choose = (qi: number, opt: string) => {
    if (answers[qi] !== undefined) return; // locked after first selection
    setAnswersByTab((prev) => ({
      ...prev,
      [tab]: { ...(prev[tab] ?? {}), [qi]: opt },
    }));
    // Single-point gamification/SRS reporting (Lesson Engine reporter).
    reportResult({
      correct: opt === drills[qi].correct,
      module: 'grammar',
      itemKey: drills[qi].prompt,
      userAnswer: opt,
      correctAnswer: drills[qi].correct,
    });
  };

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{isDE ? 'Grammatik' : 'Grammar'}</h1>
      <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
        {isDE ? 'A1-Grammatik: sein, haben, regelmäßige Verben & Fälle.' : 'A1 grammar: sein, haben, weak verbs & cases.'}
      </p>

      <TabGroup
        tabs={[
          { id: 'sein', label: 'sein', icon: BookText },
          { id: 'haben', label: 'haben', icon: Check },
          { id: 'weakVerb', label: 'machen', icon: RefreshCw },
          { id: 'stem', label: isDE ? 'Stammwechsel' : 'Stem change', icon: Shuffle },
          { id: 'modals', label: isDE ? 'Modalverben' : 'Modals', icon: Scale },
          { id: 'prefix', label: isDE ? 'Vorsilben' : 'Prefixes', icon: Split },
          { id: 'cases', label: isDE ? 'Fälle' : 'Cases', icon: Layout },
          { id: 'accusative', label: isDE ? 'Nominativ → Akkusativ' : 'Nom → Acc', icon: GitBranch },
          { id: 'bridge', label: isDE ? 'Grammatik-Brücke' : 'Grammar Bridge', icon: Globe },
        ]}
        activeTab={tab}
        onTabChange={(newTab) => { setTab(String(newTab)); }}
      />

      {tab === 'cases' && (
        <div className={`${theme.panel.surface} mb-6`}>
          <h2 className="text-lg font-semibold">{isDE ? 'Fälle' : 'Cases'}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {CASES.map((c) => (
              <div key={c.label} className="rounded-md border border-accent-100 bg-accent-50 p-4 text-body dark:border-accent-800 dark:bg-accent-950/40">
                <div className="font-bold text-accent-700 dark:text-accent-300">{c.label}</div>
                <div className="mt-1 text-ink-600 dark:text-ink-300">{isDE ? c.de : c.en}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stem-change explainer — du/er vowel shifts (static reference panel). */}
      {tab === 'stem' && (
        <div className={`${theme.panel.surface} mb-6`}>
          <h2 className="text-lg font-semibold">
            {isDE ? 'Stammwechsel: Vokalwechsel bei du/er' : 'Stem change: vowel shift for du/er'}
          </h2>
          <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Viele starke Verben ändern den Stammvokal nur in der 2. und 3. Person Singular.'
              : 'Many strong verbs change their stem vowel ONLY in the 2nd/3rd person singular.'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { group: 'e → i', demo: ['sprechen', 'sprichst', 'spricht'] },
              { group: 'e → ie', demo: ['sehen', 'siehst', 'sieht'] },
              { group: 'a → ä', demo: ['fahren', 'fährst', 'fährt'] },
            ].map((g) => (
              <div
                key={g.group}
                className="rounded-md border border-accent-100 bg-accent-50/60 p-4 text-body dark:border-accent-900/40 dark:bg-accent-950/30"
              >
                <div className="font-bold text-accent-700 dark:text-accent-300">{g.group}</div>
                <div className="mt-2 text-ink-700 dark:text-ink-200">
                  {g.demo[0]} →{' '}
                  <span className="font-bold text-accent-700 dark:text-accent-300">{g.demo[1]}</span>
                  {' / '}
                  <span className="font-bold text-accent-700 dark:text-accent-300">{g.demo[2]}</span>
                </div>
                <div className="mt-1 text-meta text-ink-500 dark:text-ink-400">
                  {isDE
                    ? 'Nur du / er / sie / es — wir und ihr bleiben regelmäßig.'
                    : 'Only du / er / sie / es — wir and ihr stay regular.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Separable vs inseparable prefix classifier (A1 Resource Pack U4). */}
      {tab === 'prefix' && (
        <div className={`${theme.panel.surface} mb-6`}>
          <h2 className="text-lg font-semibold">
            {isDE ? 'Trennbar oder untrennbar?' : 'Separable or inseparable?'}
          </h2>
          <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
            {isDE
              ? '8 untrennbare Präfixe stehen IMMER am Verb: be-, emp-, ent-, er-, ge-, miss-, ver-, zer-. Trennbare Präfixe (an-, ein-, auf-, ab-, aus-, mit-, zu-) springen im Hauptsatz ans Satzende.'
              : '8 inseparable prefixes NEVER leave the verb: be-, emp-, ent-, er-, ge-, miss-, ver-, zer-. Separable prefixes (an-, ein-, auf-, ab-, aus-, mit-, zu-) jump to the very end of the main clause.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {A1_INSEPARABLE_PREFIXES.map((p) => (
              <span
                key={p}
                className="rounded-sm border border-danger-200 bg-danger-50 px-2.5 py-1 text-meta font-bold text-danger-700 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-300"
              >
                {p}-
              </span>
            ))}
          </div>
          <div className="mt-3 text-meta text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Merkhilfe: untrennbar = Betonung auf dem VERBSTAMM (verSTEhen); trennbar = Betonung auf dem Präfix (AUFstehen).'
              : 'Stress test: inseparable → stress the ROOT (verSTEhen); separable → stress the PREFIX (AUFstehen).'}
          </div>
        </div>
      )}

      {/* P1: Nominativ → Akkusativ explainer (der → den) as an interactive
          decision tree — static reference content, no engine required. */}
      {tab === 'accusative' && (
        <div className="mb-6">
          <GrammarFlowchart
            flow={NOMINATIVE_ACCUSATIVE_FLOW}
            title={isDE ? 'Nominativ → Akkusativ (der → den)' : 'Nominative → Accusative (der → den)'}
          />
        </div>
      )}

      {tab === 'bridge' && (
        <div className="space-y-6">
          {/* Section 1: Word Order SVO vs SOV vs V2 */}
          <div className={theme.panel.surface}>
            <h2 className="text-xl font-bold text-ink-900 dark:text-white">
              {isDE ? 'Satzstellung: SVO vs. SOV' : 'Word Order: SVO vs SOV vs V2'}
            </h2>
            <p className="mt-1 text-body text-ink-500">
              {isDE
                ? 'Vergleich der Satzstruktur zwischen Deutsch, Englisch und Nepali.'
                : 'Comparing grammatical structures across German, English, and Nepali.'}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-ink-50 p-4 dark:bg-ink-800/60">
                <h3 className="font-bold text-accent-600 dark:text-accent-400">English (SVO)</h3>
                <p className="mt-1 text-meta text-ink-500">Subject + Verb + Object</p>
                <div className="mt-3 text-lg font-extrabold text-ink-800 dark:text-ink-100">
                  I <span className="underline decoration-accent-500">eat</span> an apple.
                </div>
              </div>

              {!isDE && (
                <div className="rounded-lg bg-ink-50 p-4 dark:bg-ink-800/60">
                  <h3 className="font-bold text-warning-600 dark:text-warning-400">Nepali (SOV)</h3>
                  <p className="mt-1 text-meta text-ink-500">Subject + Object + Verb</p>
                  <div className="mt-3 text-lg font-extrabold text-ink-800 dark:text-ink-100">
                    म स्याउ <span className="underline decoration-warning-500">खान्छु</span>।
                  </div>
                  <p className="mt-1 text-meta italic text-ink-500">Ma syau khanchhu.</p>
                </div>
              )}

              <div className="rounded-lg border-2 border-success-200 bg-success-50/50 p-4 dark:border-success-800/40 dark:bg-success-950/20">
                <h3 className="font-bold text-success-700 dark:text-success-400">German (V2 / Verb-Second)</h3>
                <p className="mt-1 text-meta text-ink-500">Subject + Verb (Position 2) + Object</p>
                <div className="mt-3 text-lg font-extrabold text-ink-800 dark:text-ink-100">
                  Ich <span className="text-success-600 underline">esse</span> einen Apfel.
                </div>
                <div className="mt-2 h-px bg-success-200/50" />
                <p className="mt-2 text-meta text-ink-500">Subordinate clauses push verb to the end:</p>
                <div className="mt-1 text-body font-semibold text-ink-700 dark:text-ink-300">
                  ...weil ich einen Apfel <span className="text-success-600 underline">esse</span>.
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Formality map Timi/Tapai vs Du/Sie */}
          <div className={theme.panel.surface}>
            <h2 className="text-xl font-bold text-ink-900 dark:text-white">
              {isDE ? 'Höflichkeit: Du vs. Sie' : 'Formality Map: Timi/Tapai ↔ Du/Sie'}
            </h2>
            <p className="mt-1 text-body text-ink-500">
              {isDE
                ? 'Deutsche Du/Sie-Formen entsprechen perfekt तिमी/तपाईं im Nepali.'
                : 'German informal du / formal Sie maps perfectly to Timi / Tapai in Nepali.'}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-ink-50 p-5 dark:bg-ink-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧑‍🤝‍🧑</span>
                  <h3 className="font-bold text-ink-800 dark:text-ink-100">Informal — du (German) ↔ तिमी (Nepali)</h3>
                </div>
                <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
                  Used for friends, family, children, and peers.
                </p>
                <div className="mt-4 space-y-2 rounded-md bg-white p-3 text-body dark:bg-ink-950">
                  <div className="flex justify-between">
                    <span className="font-semibold text-accent-600">Wie geht es dir?</span>
                    {!isDE && <span className="text-ink-500">तिमीलाई कस्तो छ?</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-accent-600">Wie heißt du?</span>
                    {!isDE && <span className="text-ink-500">तिमीलाई के भन्छन्?</span>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-ink-50 p-5 dark:bg-ink-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💼</span>
                  <h3 className="font-bold text-ink-800 dark:text-ink-100">Formal — Sie (German) ↔ तपाईं (Nepali)</h3>
                </div>
                <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
                  Used for strangers, teachers, doctors, and respected elders.
                </p>
                <div className="mt-4 space-y-2 rounded-md bg-white p-3 text-body dark:bg-ink-950">
                  <div className="flex justify-between">
                    <span className="font-semibold text-success-700">Wie geht es Ihnen?</span>
                    {!isDE && <span className="text-ink-500">तपाईंलाई कस्तो छ?</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-success-700">Wie heißen Sie?</span>
                    {!isDE && <span className="text-ink-500">तपाईंको नाम के हो?</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab !== 'bridge' && tab !== 'accusative' && (
        drillsLoading ? (
          <p role="status" aria-live="polite" className="mt-4 text-body text-ink-500 dark:text-ink-400">
            {isDE ? 'Übungen werden geladen…' : 'Loading drills…'}
          </p>
        ) : drillsFailed ? (
          <div role="alert" className="mt-4 rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-800 dark:border-warning-800 dark:bg-warning-950/40 dark:text-warning-200">
            <p>{isDE ? 'Übungen konnten nicht geladen werden.' : 'Drills could not be loaded.'}</p>
            <button type="button" onClick={() => setReloadDrills((attempt) => attempt + 1)} className={`${theme.button.secondary} mt-3`}>
              {isDE ? 'Erneut versuchen' : 'Retry'}
            </button>
          </div>
        ) : drills.length === 0 ? (
          <p className="mt-4 text-body text-ink-500 dark:text-ink-400">
            {isDE ? 'Für diesen Bereich sind noch keine Übungen verfügbar.' : 'No drills are available for this section yet.'}
          </p>
        ) : (
        <div className={`${theme.panel.surface}`}>
        <h2 className="text-lg font-semibold">{isDE ? 'Mini-Übung' : 'Mini-drill'} — {count}/{drills.length}</h2>
        <div className="mt-3 space-y-4">
          {drills.map((d, i) => (
            <div key={d.prompt}>
              <div className="mb-2 text-body font-medium text-ink-700 dark:text-ink-200">{d.prompt}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {d.options.map((opt) => {
                  const chosen = answers[i] === opt;
                  const ok = d.correct === opt;
                  let cls = theme.button.pill;
                  if (chosen && ok) cls += ' border-success-500 bg-success-100 text-success-800';
                  else if (chosen && !ok) cls += ' border-danger-500 bg-danger-100 text-danger-800';
                  return <button key={opt} type="button" className={cls} onClick={() => choose(i, opt)}>{opt}</button>;
                })}
              </div>
            </div>
          ))}
          {allDone && (
            <div className={`rounded-md p-3 text-body font-semibold ${score === drills.length ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300' : 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'}`}>
              {isDE ? `Ergebnis: ${score}/${drills.length}` : `Score: ${score}/${drills.length}`}
            </div>
          )}
          </div>
        </div>
        )
      )}
    </div>
  );
}
