/* ── grammar rules library ── */
import { A1_CURRICULUM } from '../data/a1Path';
import type { UserLevel } from './conversationManager';

// Lightweight, deterministic rule set for common A1 German patterns.
// Import & use in responseHandlers.ts grammar_question + explain_mistake.

/** All rules that apply to the current unit, selected from the curriculum JSON. */
export type GrammarRule = {
  id: string
  tag: 'article' | 'word-order' | 'verb-position' | 'case' | 'pronoun' | 'negation' | 'question'
  levels: UserLevel[]
  title: { en: string; de?: string; ne?: string }
  /** Short explanation the model may quote (never invent beyond this). */
  explanation: { en: string; de?: string; ne?: string }
  /** One short, level-appropriate German example. */
  example: { de: string; en: string; notes?: string }
  /** Common learner traps for this rule (helps the model stay on-track). */
  commonTraps?: string[]
}

/** Pull rules from the active unit's pedagogy, if available. */
export function getGrammarRules(
  unitIndex: number,
  levels: UserLevel[],
): GrammarRule[] {
  const unit = A1_CURRICULUM.units[unitIndex];
  if (!unit?.pedagogy?.ruleTable?.rows?.length) return []

  const rules: GrammarRule[] = []
  for (const row of unit.pedagogy.ruleTable.rows) {
    // Only include rows matching the requested levels
    if (!levels.length) continue

    rules.push({
      id: `rule-${row.label.en}`,
      tag: mapLabelToTag(row.label.en),
      levels: ['A1.1', 'A1.2', 'A2.1'] as UserLevel[],
      title: { en: row.label.en || 'Rule', de: row.label.de || 'Regel' },
      explanation: {
        en: row.usage.en || 'No explanation loaded.',
        de: row.usage.de || 'Keine Erklärung geladen.',
      },
      example: {
        de: row.example.de || '',
        en: row.example.en || '',
      },
    })
  }
  return rules
}

function mapLabelToTag(label: string): GrammarRule['tag'] {
  const lowered = label.toLowerCase()
  if (lowered.includes('artikel') || lowered.includes('article')) return 'article'
  if (lowered.includes('wortstellung') || lowered.includes('word order') || lowered.includes('word-order'))
    return 'word-order'
  if (lowered.includes('verb') || lowered.includes('konjug')) return 'verb-position'
  if (lowered.includes('fall') || lowered.includes('cas')) return 'case'
  if (lowered.includes('pronomen') || lowered.includes('pronoun')) return 'pronoun'
  if (lowered.includes('vernein') || lowered.includes('negation')) return 'negation'
  if (lowered.includes('frage') || lowered.includes('question')) return 'question'
  return 'article' // default safe tag
}