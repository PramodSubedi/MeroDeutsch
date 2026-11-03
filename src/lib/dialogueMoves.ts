/** src/lib/dialogueMoves.ts – Scripted communicative moves for the companion.
 * 
 * MOVE: Confirm – when an ambiguous entity is detected.
 */
export interface FollowUpChip {
  id: string;
  label: string;
  payload: string | { intent: string; entity?: string };
}

/** Move: Confirm – when an ambiguous entity is detected. */
export function moveConfirm(
  message: string,
  isDE: boolean
): { text: string; confirmOptions: string[] } {
  const quoted = message.match(/[\"\']([^"\']{1,30})[\"\']/);
  if (quoted) {
    const word = quoted[1];
    const label = isDE ? `Meinst du **${word}**?` : `Do you mean **${word}**?`;
    return {
      text: label,
      confirmOptions: isDE ? ['Ja', 'Nein, anderes'] : ['Yes', 'No, something else'],
    };
  }
  return {
    text: isDE ? 'Worauf meinst du?' : 'What are you referring to?',
    confirmOptions: isDE ? ['Etwas anderes', 'Erkläre mir mehr'] : ['Something else', 'Tell me more'],
  };
}

/** Move: Encourage – after quiz / progress. */
export function moveEncourage(
  success: boolean,
  memory: import('../types/chatbot').LearnerMemory,
  isDE: boolean
): { text: string; chip?: FollowUpChip } {
  if (success) {
    const celebrationIsDE = isDE
      ? `Super! ${memory.streak > 0 ? `${memory.streak} Tage Serie!` : 'Weiter so!'}`
      : `Great! ${memory.streak > 0 ? `${memory.streak}-day streak!` : 'Keep it up!'}`;
    const chip: FollowUpChip = {
      id: 'continue',
      label: isDE ? 'Noch eine Runde' : 'One more round',
      payload: { intent: 'start_quiz', entity: undefined },
    };
    return { text: celebrationIsDE, chip };
  } else {
    const encouragementIsDE = isDE
      ? `Fast geschafft! Versuch es nochmal.`
      : `Almost there! Try again.`;
    return { text: encouragementIsDE };
  }
}

/** Move: Clarify – when there are multiple valid paths. */
export function moveClarify(
  intent: import('../types/chatbot').Intent,
  isDE: boolean
): { text: string; chip?: FollowUpChip } {
  const text = isDE
    ? `Meinst du ${intent === 'grammar_question' ? 'eine Grammatikregel' : 'eine Übung'}?`
    : `Do you mean ${intent === 'grammar_question' ? 'a grammar rule' : 'an exercise'}?`;
  return { text };
}