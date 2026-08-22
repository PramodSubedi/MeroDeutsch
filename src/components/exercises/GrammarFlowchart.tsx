/**
 * src/components/exercises/GrammarFlowchart.tsx
 *
 * Lesson Engine primitive — interactive grammar DECISION TREES rendered as
 * crisp academic reference diagrams.
 *
 * Data-driven: pages pass a `GrammarFlowchart` definition (question nodes with
 * branching options -> result nodes). The component renders the learner's PATH
 * as a vertical flow of cards connected by SVG arrows (crisp 2px strokes,
 * rounded elbows) — high-clarity, zero visual clutter.
 *
 * Result nodes may carry an `article`, rendered with the LOCKED gender color
 * tokens (#2563eb der / #e11d48 die / #059669 das via theme.gender).
 *
 * Ships with NOMINATIVE_ACCUSATIVE_FLOW — the A1 case-declension decision
 * tree (der→den etc.) ready to embed on GrammarPage or Unit checkpoints.
 *
 * Design: theme.* classes, ≥44px targets, active:scale-95, light/dark.
 */

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import type { Article } from '../../data/a1Path';

/* ────────────────────────────────────────────────────────────
 * Flowchart data model
 * ──────────────────────────────────────────────────────────── */

export interface FlowOption {
  label: string;
  nextId: string;
}

export interface FlowResult {
  title: string;
  /** Optional article highlighted with the locked gender token. */
  article?: Article;
  explanation: string;
  examples?: string[];
}

export type FlowNode =
  | { id: string; kind: 'question'; question: string; options: FlowOption[] }
  | { id: string; kind: 'result'; result: FlowResult };

export interface GrammarFlow {
  startId: string;
  nodes: Record<string, FlowNode>;
}

/** Map an article to its theme.gender token key ('die' -> 'dieF'). */
function genderKey(art: Article): 'der' | 'dieF' | 'das' {
  return art === 'die' ? 'dieF' : art;
}

/* ────────────────────────────────────────────────────────────
 * Example dataset: Nominativ vs Akkusativ (A1 case declensions)
 * ──────────────────────────────────────────────────────────── */

export const NOMINATIVE_ACCUSATIVE_FLOW: GrammarFlow = {
  startId: 'q-role',
  nodes: {
    'q-role': {
      id: 'q-role',
      kind: 'question',
      question: 'What role does the noun play in the sentence?',
      options: [
        { label: 'Subject (the doer)', nextId: 'q-subject-gender' },
        { label: 'Direct object (being acted on)', nextId: 'q-object-gender' },
      ],
    },
    'q-subject-gender': {
      id: 'q-subject-gender',
      kind: 'question',
      question: 'Which noun is it? (NOMINATIV — subject keeps its base form)',
      options: [
        { label: 'Masculine (der …)', nextId: 'r-nom-der' },
        { label: 'Feminine (die …)', nextId: 'r-nom-die' },
        { label: 'Neuter (das …)', nextId: 'r-nom-das' },
      ],
    },
    'q-object-gender': {
      id: 'q-object-gender',
      kind: 'question',
      question: 'Which noun is it? (AKKUSATIV — ONLY masculine changes)',
      options: [
        { label: 'Masculine (der → den)', nextId: 'r-akk-den' },
        { label: 'Feminine (die stays die)', nextId: 'r-akk-die' },
        { label: 'Neuter (das stays das)', nextId: 'r-akk-das' },
      ],
    },
    'r-nom-der': {
      id: 'r-nom-der',
      kind: 'result',
      result: {
        title: 'Nominativ · Maskulin',
        article: 'der',
        explanation: 'The subject keeps its dictionary form. der Mann liest.',
        examples: ['Der Mann liest ein Buch.', 'Der Hund ist groß.'],
      },
    },
    'r-nom-die': {
      id: 'r-nom-die',
      kind: 'result',
      result: {
        title: 'Nominativ · Feminin',
        article: 'die',
        explanation: 'Feminine nouns keep die in every case except Genitiv.',
        examples: ['Die Frau fährt Auto.', 'Die Katze schläft.'],
      },
    },
    'r-nom-das': {
      id: 'r-nom-das',
      kind: 'result',
      result: {
        title: 'Nominativ · Neutrum',
        article: 'das',
        explanation: 'Neuter nouns keep das in Nominativ and Akkusativ.',
        examples: ['Das Kind spielt.', 'Das Haus ist neu.'],
      },
    },
    'r-akk-den': {
      id: 'r-akk-den',
      kind: 'result',
      result: {
        title: 'Akkusativ · Maskulin',
        article: 'der',
        explanation:
          'ONLY masculine changes in Akkusativ: der → den. Ich sehe den Mann.',
        examples: ['Ich sehe den Mann.', 'Er kauft den Hund.'],
      },
    },
    'r-akk-die': {
      id: 'r-akk-die',
      kind: 'result',
      result: {
        title: 'Akkusativ · Feminin',
        article: 'die',
        explanation: 'Feminine does NOT change: die Frau → die Frau.',
        examples: ['Ich sehe die Frau.', 'Sie kauft die Katze.'],
      },
    },
    'r-akk-das': {
      id: 'r-akk-das',
      kind: 'result',
      result: {
        title: 'Akkusativ · Neutrum',
        article: 'das',
        explanation: 'Neuter does NOT change: das Kind → das Kind.',
        examples: ['Ich sehe das Kind.', 'Wir kaufen das Haus.'],
      },
    },
  },
};

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

interface GrammarFlowchartProps {
  flow: GrammarFlow;
  title?: string;
}

/** Crisp SVG elbow connector between two stacked cards. */
function FlowConnector() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 28"
      className="mx-auto block h-7 w-6 text-slate-300 dark:text-slate-600"
      fill="none"
    >
      <path
        d="M12 0 V20 M5 14 L12 21 L19 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GrammarFlowchart({ flow, title }: GrammarFlowchartProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  /** Trail of node ids from the start to the current position. */
  const [trail, setTrail] = useState<string[]>([flow.startId]);

  const currentId = trail[trail.length - 1];
  const currentNode = flow.nodes[currentId];

  const breadcrumbLabels = useMemo(
    () =>
      trail.map((id) => {
        const node = flow.nodes[id];
        return node?.kind === 'question' ? node.question : node?.result.title ?? '';
      }),
    [trail, flow.nodes]
  );

  if (!currentNode) return null;

  const choose = (nextId: string) => setTrail((t) => [...t, nextId]);
  const restart = () => setTrail([flow.startId]);
  const stepBack = () => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));

  return (
    <div className={theme.panel.surface}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
            {title ?? (isDE ? 'Grammatik-Entscheidungsbaum' : 'Grammar decision tree')}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Folge den Fragen zu deiner Form.'
              : 'Follow the questions to your form.'}
          </p>
        </div>
        <button
          type="button"
          onClick={restart}
          className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-1.5 !px-3 !py-2 text-sm`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {isDE ? 'Neustart' : 'Restart'}
        </button>
      </div>

      {/* Breadcrumb trail (compact path summary) */}
      {trail.length > 1 && (
        <ol className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {breadcrumbLabels.slice(0, -1).map((label, i) => (
            <li key={`${trail[i]}-bc`} className="flex items-center gap-1.5">
              <span className="max-w-[220px] truncate">{label}</span>
              <span aria-hidden="true">→</span>
            </li>
          ))}
          <li className="font-semibold text-blue-600 dark:text-blue-300">
            {breadcrumbLabels[breadcrumbLabels.length - 1]}
          </li>
        </ol>
      )}

      {/* Vertical flow of visited cards + current node */}
      <div>
        {trail.slice(0, -1).map((id) => {
          const node = flow.nodes[id];
          if (!node || node.kind !== 'question') return null;
          return (
            <div key={id}>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                {node.question}
              </div>
              <FlowConnector />
            </div>
          );
        })}

        {/* Current node */}
        {currentNode.kind === 'question' ? (
          <div className="rounded-2xl border-2 border-blue-200 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-slate-900">
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {currentNode.question}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {currentNode.options.map((opt) => (
                <button
                  key={opt.nextId}
                  type="button"
                  onClick={() => choose(opt.nextId)}
                  className={`min-h-[44px] rounded-xl px-4 py-3 text-left text-sm font-semibold transition active:scale-95 ${theme.button.pill}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ResultCard result={currentNode.result} />
        )}
      </div>

      {/* Step back */}
      {trail.length > 1 && (
        <div className="mt-4 flex justify-start">
          <button type="button" onClick={stepBack} className={theme.button.secondary}>
            ← {isDE ? 'Zurück' : 'Back'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Terminal result card — gender token highlight + examples. */
function ResultCard({ result }: { result: FlowResult }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center gap-2">
        {result.article && (
          <span
            className={`inline-flex h-8 min-w-[3rem] items-center justify-center rounded-lg px-2 text-sm font-bold text-white ${theme.gender[genderKey(result.article)].bg}`}
          >
            {result.article}
          </span>
        )}
        <h4 className="text-lg font-bold text-slate-900 dark:text-white">{result.title}</h4>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {result.explanation}
      </p>
      {result.examples && result.examples.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {result.examples.map((ex) => (
            <li
              key={ex}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100"
            >
              {isDE ? ex : ex}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}