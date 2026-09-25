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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Grammatik' : 'Grammar'}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
              <div key={c.label} className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/40">
                <div className="font-bold text-blue-700 dark:text-blue-300">{c.label}</div>
                <div className="mt-1 text-slate-600 dark:text-slate-300">{isDE ? c.de : c.en}</div>
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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
                className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm dark:border-indigo-900/40 dark:bg-indigo-950/30"
              >
                <div className="font-bold text-indigo-700 dark:text-indigo-300">{g.group}</div>
                <div className="mt-2 text-slate-700 dark:text-slate-200">
                  {g.demo[0]} →{' '}
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">{g.demo[1]}</span>
                  {' / '}
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">{g.demo[2]}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? '8 untrennbare Präfixe stehen IMMER am Verb: be-, emp-, ent-, er-, ge-, miss-, ver-, zer-. Trennbare Präfixe (an-, ein-, auf-, ab-, aus-, mit-, zu-) springen im Hauptsatz ans Satzende.'
              : '8 inseparable prefixes NEVER leave the verb: be-, emp-, ent-, er-, ge-, miss-, ver-, zer-. Separable prefixes (an-, ein-, auf-, ab-, aus-, mit-, zu-) jump to the very end of the main clause.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {A1_INSEPARABLE_PREFIXES.map((p) => (
              <span
                key={p}
                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                {p}-
              </span>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
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
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isDE ? 'Satzstellung: SVO vs. SOV' : 'Word Order: SVO vs SOV vs V2'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isDE
                ? 'Vergleich der Satzstruktur zwischen Deutsch, Englisch und Nepali.'
                : 'Comparing grammatical structures across German, English, and Nepali.'}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <h3 className="font-bold text-blue-600 dark:text-blue-400">English (SVO)</h3>
                <p className="mt-1 text-xs text-slate-500">Subject + Verb + Object</p>
                <div className="mt-3 text-lg font-extrabold text-slate-800 dark:text-slate-100">
                  I <span className="underline decoration-blue-500">eat</span> an apple.
                </div>
              </div>

              {!isDE && (
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <h3 className="font-bold text-amber-600 dark:text-amber-400">Nepali (SOV)</h3>
                  <p className="mt-1 text-xs text-slate-500">Subject + Object + Verb</p>
                  <div className="mt-3 text-lg font-extrabold text-slate-800 dark:text-slate-100">
                    म स्याउ <span className="underline decoration-amber-500">खान्छु</span>।
                  </div>
                  <p className="mt-1 text-xs italic text-slate-400">Ma syau khanchhu.</p>
                </div>
              )}

              <div className="rounded-2xl border-2 border-green-200 bg-green-50/50 p-4 dark:border-green-800/40 dark:bg-green-950/20">
                <h3 className="font-bold text-green-700 dark:text-green-400">German (V2 / Verb-Second)</h3>
                <p className="mt-1 text-xs text-slate-500">Subject + Verb (Position 2) + Object</p>
                <div className="mt-3 text-lg font-extrabold text-slate-800 dark:text-slate-100">
                  Ich <span className="text-green-600 underline">esse</span> einen Apfel.
                </div>
                <div className="mt-2 h-px bg-green-200/50" />
                <p className="mt-2 text-xs text-slate-500">Subordinate clauses push verb to the end:</p>
                <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  ...weil ich einen Apfel <span className="text-green-600 underline">esse</span>.
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Formality map Timi/Tapai vs Du/Sie */}
          <div className={theme.panel.surface}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isDE ? 'Höflichkeit: Du vs. Sie' : 'Formality Map: Timi/Tapai ↔ Du/Sie'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isDE
                ? 'Deutsche Du/Sie-Formen entsprechen perfekt तिमी/तपाईं im Nepali.'
                : 'German informal du / formal Sie maps perfectly to Timi / Tapai in Nepali.'}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧑‍🤝‍🧑</span>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Informal — du (German) ↔ तिमी (Nepali)</h3>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Used for friends, family, children, and peers.
                </p>
                <div className="mt-4 space-y-2 rounded-xl bg-white p-3 text-sm dark:bg-slate-950">
                  <div className="flex justify-between">
                    <span className="font-semibold text-blue-600">Wie geht es dir?</span>
                    {!isDE && <span className="text-slate-500">तिमीलाई कस्तो छ?</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-blue-600">Wie heißt du?</span>
                    {!isDE && <span className="text-slate-500">तिमीलाई के भन्छन्?</span>}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💼</span>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Formal — Sie (German) ↔ तपाईं (Nepali)</h3>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Used for strangers, teachers, doctors, and respected elders.
                </p>
                <div className="mt-4 space-y-2 rounded-xl bg-white p-3 text-sm dark:bg-slate-950">
                  <div className="flex justify-between">
                    <span className="font-semibold text-green-700">Wie geht es Ihnen?</span>
                    {!isDE && <span className="text-slate-500">तपाईंलाई कस्तो छ?</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-green-700">Wie heißen Sie?</span>
                    {!isDE && <span className="text-slate-500">तपाईंको नाम के हो?</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab !== 'bridge' && tab !== 'accusative' && (
        drillsLoading ? (
          <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {isDE ? 'Übungen werden geladen…' : 'Loading drills…'}
          </p>
        ) : drillsFailed ? (
          <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p>{isDE ? 'Übungen konnten nicht geladen werden.' : 'Drills could not be loaded.'}</p>
            <button type="button" onClick={() => setReloadDrills((attempt) => attempt + 1)} className={`${theme.button.secondary} mt-3`}>
              {isDE ? 'Erneut versuchen' : 'Retry'}
            </button>
          </div>
        ) : drills.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {isDE ? 'Für diesen Bereich sind noch keine Übungen verfügbar.' : 'No drills are available for this section yet.'}
          </p>
        ) : (
        <div className={`${theme.panel.surface}`}>
        <h2 className="text-lg font-semibold">{isDE ? 'Mini-Übung' : 'Mini-drill'} — {count}/{drills.length}</h2>
        <div className="mt-3 space-y-4">
          {drills.map((d, i) => (
            <div key={d.prompt}>
              <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{d.prompt}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {d.options.map((opt) => {
                  const chosen = answers[i] === opt;
                  const ok = d.correct === opt;
                  let cls = theme.button.pill;
                  if (chosen && ok) cls += ' border-green-500 bg-green-100 text-green-800';
                  else if (chosen && !ok) cls += ' border-red-500 bg-red-100 text-red-800';
                  return <button key={opt} type="button" className={cls} onClick={() => choose(i, opt)}>{opt}</button>;
                })}
              </div>
            </div>
          ))}
          {allDone && (
            <div className={`rounded-xl p-3 text-sm font-semibold ${score === drills.length ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
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
