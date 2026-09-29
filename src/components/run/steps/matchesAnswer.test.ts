/**
 * src/components/run/steps/matchesAnswer.test.ts
 *
 * The function that decides whether a learner is correct, tested against the
 * inputs real learners produce.
 *
 * The failure this guards against is specific and one-directional: being too
 * STRICT. A wrongly-rejected answer is a learner who knows the German being told
 * they are wrong, which is the worst thing this component can do. Being slightly
 * lenient on a near-miss is a much smaller harm, so every case here is a real
 * input that must be ACCEPTED, and the negative cases are only genuinely
 * different answers.
 */
import { describe, expect, it } from 'vitest';
import { matchesAnswer, normaliseAnswer } from './matchesAnswer';

describe('normaliseAnswer', () => {
  it('folds case and surrounding space', () => {
    expect(normaliseAnswer('  Wohnung  ')).toBe('wohnung');
  });

  it('folds ß to ss', () => {
    expect(normaliseAnswer('Straße')).toBe(normaliseAnswer('Strasse'));
  });

  it('folds accents to their base letter', () => {
    expect(normaliseAnswer('schön')).toBe(normaliseAnswer('schon'));
  });

  it('drops terminal punctuation only', () => {
    expect(normaliseAnswer('Schlafzimmer.')).toBe('schlafzimmer');
    expect(normaliseAnswer('Wie geht es?')).toBe('wie geht es');
    // Interior punctuation is content, not noise.
    expect(normaliseAnswer('zwischen, wann')).not.toBe('zwischen wann');
  });

  it('collapses runs of whitespace', () => {
    expect(normaliseAnswer('guten   Morgen')).toBe('guten morgen');
  });

  it('folds the typographic apostrophe', () => {
    // `ä` also folds to `a` here — that is the accent stripper doing its job, and
    // it is why the expectation is written against the FOLDED form rather than
    // the original. What this case is about is the apostrophe, not the umlaut.
    expect(normaliseAnswer('Mädchen’s')).toBe('madchen\'s');
    expect(normaliseAnswer("Mädchen's")).toBe('madchen\'s');
  });
});

describe('matchesAnswer', () => {
  it('accepts the exact answer', () => {
    expect(matchesAnswer('wohnt', 'wohnt')).toBe(true);
  });

  it('accepts a differently-cased answer', () => {
    expect(matchesAnswer('Wohnt', 'wohnt')).toBe(true);
  });

  it('accepts a trailing full stop', () => {
    expect(matchesAnswer('schlafe.', 'schlafe')).toBe(true);
  });

  it('accepts ß for ss', () => {
    expect(matchesAnswer('Straße', 'Strasse')).toBe(true);
  });

  it('accepts an unaccented keyboard', () => {
    expect(matchesAnswer('schon', 'schön')).toBe(true);
  });

  it('accepts a listed alternative — the (einen/ein) choice', () => {
    expect(matchesAnswer('ein', 'einen', ['ein'])).toBe(true);
  });

  it('still rejects a wrong answer', () => {
    expect(matchesAnswer('wohne', 'wohnt')).toBe(false);
  });

  it('rejects an answer that is merely a prefix', () => {
    expect(matchesAnswer('wohn', 'wohnt')).toBe(false);
  });

  it('rejects an empty input — an unanswered step is not correct', () => {
    expect(matchesAnswer('', 'wohnt')).toBe(false);
    expect(matchesAnswer('   ', 'wohnt')).toBe(false);
  });

  it('does not accept an alternative that is not listed', () => {
    expect(matchesAnswer('den', 'einen', ['ein'])).toBe(false);
  });

  it('matches a full sentence regardless of its end punctuation', () => {
    expect(matchesAnswer('Heute ist Montag.', 'Heute ist Montag')).toBe(true);
  });
});
