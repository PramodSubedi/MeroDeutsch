import { describe, expect, it } from 'vitest';
import { resolvePushTarget } from './pushTarget';
import { CEFR_LEVELS_ROUTE, A1_PATH_ROUTE } from '../data/cefrLevels';

describe('resolvePushTarget', () => {
  const node = { to: '/lesson/3', label: { en: 'Numbers', de: 'Zahlen' } };

  it('uses the push node route when the campaign has a next step', () => {
    expect(resolvePushTarget(node, false).to).toBe('/lesson/3');
    expect(resolvePushTarget(node, true).to).toBe('/lesson/3');
  });

  it('labels the next step, localized', () => {
    expect(resolvePushTarget(node, false).label).toBe('Next: Numbers');
    expect(resolvePushTarget(node, true).label).toBe('Weiter: Zahlen');
  });

  it('is never complete while a push node exists', () => {
    expect(resolvePushTarget(node, false).isComplete).toBe(false);
  });

  it('sends a finished learner to the level grid, never back to the course', () => {
    const finished = resolvePushTarget(null, false);
    expect(finished.to).toBe(CEFR_LEVELS_ROUTE);
    expect(finished.to).not.toBe(A1_PATH_ROUTE);
    expect(finished.isComplete).toBe(true);
  });

  it('treats an undefined push node the same as null', () => {
    expect(resolvePushTarget(undefined, false)).toEqual(resolvePushTarget(null, false));
  });

  it('localizes the finished label', () => {
    expect(resolvePushTarget(null, false).label).toBe('All levels');
    expect(resolvePushTarget(null, true).label).toBe('Alle Niveaus');
  });

  it('never returns a target equal to the caller page (/learn)', () => {
    expect(resolvePushTarget(node, false).to).not.toBe(A1_PATH_ROUTE);
    expect(resolvePushTarget(null, false).to).not.toBe(A1_PATH_ROUTE);
  });
});
