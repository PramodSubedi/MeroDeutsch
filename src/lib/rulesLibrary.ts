/* ── grammar rules library ── */

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
  const unit = unitAt(unitIndex)
  if (!unit?.pedagogy?.ruleTable?.rows?.length) return []

  const rules: GrammarRule[] = []
  for (const row of unit.pedagogy.ruleTable.rows) {
    // Only include rows matching the requested levels
    if (!levels.some(l => l.toString().includes(row.level || 'A1'))) continue

    rules.push({
      id: row.id || `rule-${row.label}`,
      tag: mapLabelToTag(row.label),
      levels: ['A1.1', 'A1.2', 'A2.1'].filter(l => /* level check */ true),
      title: { en: row.label || 'Rule', de: row.label || 'Regel' },
      explanation: {
        en: row.explanation || 'No explanation loaded.',
        de: row.explanationDe || 'Keine Erklärung geladen.',
      },
      example: {
        de: row.exampleDe || '',
        en: row.exampleEn || '',
      },
      commonTraps: row.commonTraps
        ? row.commonTraps.split('|').filter(Boolean)
        : undefined,
    })
  }
  return rules
}

function mapLabelToTag(label: string): GrammarRule['tag'] {
  const lowered = label.toLowerCase()
  if (lowed.includes('artikel') || lowed.includes('article')) return 'article'
  if (lowed.includes('wortstellung') || lowed.includes('word order') || lowed.includes('word-order'))
    return 'word-order'
  if (lowed.includes('verb') || lowed.includes('konjug')) return 'verb-position'
  if (lowed.includes('fall') || lowed.includes('cas')) return 'case'
  if (lowed.includes('pronomen') || lowed.includes('pronoun')) return 'pronoun'
  if (lowed.includes('vernein') || lowed.includes('negation')) return 'negation'
  if (lowed.includes('frage') || lowed.includes('question')) return 'question'
  return 'article' // default safe tag
}