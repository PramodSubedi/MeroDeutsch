/**
 * src/data/lessonRender/source.check.ts
 *
 *   npx tsx src/data/lessonRender/source.check.ts
 *
 * The property under test is NOT "does the run renderer work" — it is "does the
 * legacy lesson still render when the switch is absent, misspelled, hostile, or
 * unreachable". Every case below is something that can reach production: an
 * operator typo, a dropped `app_config` row, a migration that never ran, a
 * network error on a learner on the subway. Each one must land on `legacy`.
 */
import { CONFIG_KEYS } from '../../shared/configKeys';
import {
  LESSON_RENDER_KEY,
  LESSON_RENDER_VALUES,
  isKnownLessonRender,
  legacyDecision,
  resolveLessonRender,
} from './source';
import {
  __resetLessonRenderResolution,
  __setReaderForTest,
  LESSON_RENDER_CACHE_KEY,
  getLessonRender,
  getLessonRenderRead,
  resolveLessonRenderOnce,
  startLessonRenderResolution,
  subscribeLessonRender,
} from './resolveActive';

let checks = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  checks += 1;
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

const flagIs = (value: unknown) => () => Promise.resolve(value);

/**
 * A minimal in-memory `localStorage`.
 *
 * The cache is the whole reason the switch does not flash legacy→run on every
 * lesson open, so it has to be exercised for real. `tsx` runs in Node, which has
 * no `localStorage` by default, and without a stub the module's `typeof
 * localStorage === 'undefined'` guard silently returns `undefined` for every
 * read — which makes every cache assertion pass for the wrong reason (it would
 * be reading the in-memory `current` instead). Installing the stub before the
 * module is used is what makes section 9 mean what it claims.
 */
const store = new Map<string, string>();
const memoryStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
(globalThis as unknown as { localStorage: unknown }).localStorage = memoryStorage;

console.log('\n=== 0. THE CACHE IS REACHABLE IN THIS ENVIRONMENT ===');
// If this fails the cache is inert here and section 9 proves nothing.
check('localStorage is installed', typeof localStorage !== 'undefined');
check('it starts empty', localStorage.getItem(LESSON_RENDER_CACHE_KEY) === null);

console.log('\n=== 1. THE DEFAULT IS THE EXISTING RENDERER ===');
// The single most important property. If this inverts, a missing config row
// breaks every lesson in production.
check('the flag key is the agreed name', LESSON_RENDER_KEY === 'lesson_render', LESSON_RENDER_KEY);
check('an absent flag renders legacy', resolveLessonRender(undefined).render === 'legacy');
check('an absent flag is reported as unreadable', resolveLessonRender(undefined).reason === 'flag-unreadable');
check('an explicit "legacy" renders legacy', resolveLessonRender('legacy').render === 'legacy');
check('an explicit "run" renders run', resolveLessonRender('run').render === 'run');
check('"legacy" is reported as intentional', resolveLessonRender('legacy').reason === 'flag-is-legacy');
check('"run" is reported as intentional', resolveLessonRender('run').reason === 'flag-is-run');
check('the module default is legacy', legacyDecision().render === 'legacy');

console.log('\n=== 2. A BAD FLAG DEGRADES, NEVER THROWS ===');
for (const bad of [null, 0, 1, true, {}, [], '', '  ', 'runn', 'RUNS', 'yes', 'true', 'steps']) {
  check(`${JSON.stringify(bad)} falls back to legacy`, resolveLessonRender(bad).render === 'legacy');
}
check('"RUN" (case) still selects run', resolveLessonRender('RUN').render === 'run');
check('" run " (padded) still selects run', resolveLessonRender(' run ').render === 'run');
check('"Legacy" (case) still selects legacy', resolveLessonRender('Legacy').reason === 'flag-is-legacy');

console.log('\n=== 3. THE VOCABULARY MATCHES THE WRITABLE REGISTRY ===');
// The duplication in `source.ts` is only safe while this holds: the resolver
// accepts exactly what the control centre is allowed to store.
const spec = CONFIG_KEYS[LESSON_RENDER_KEY];
check('the key is writable config', spec !== undefined);
check('it is a string key', spec?.types.includes('string') === true);
const registryValues = spec?.values ?? [];
check(
  'the resolver vocabulary equals the registry vocabulary',
  registryValues.length === LESSON_RENDER_VALUES.length &&
    registryValues.every((v) => LESSON_RENDER_VALUES.includes(v as 'legacy' | 'run')),
  `${registryValues.join(',')} vs ${LESSON_RENDER_VALUES.join(',')}`,
);
check('every registry value is recognised', registryValues.every(isKnownLessonRender));
check('a value outside the registry is not recognised', !isKnownLessonRender('document'));

console.log('\n=== 4. A THROWING FLAG READ IS SURVIVED ===');
(async () => {
  __resetLessonRenderResolution();
  __setReaderForTest(() => {
    throw new Error('offline');
  });
  const d = await resolveLessonRenderOnce();
  check('a throwing read does not switch the renderer', getLessonRender() === 'legacy');
  check('it is reported as unreadable', d.reason === 'flag-unreadable');
  check('the failure is observable', getLessonRenderRead()?.reason === 'flag-unreadable');
  check('the failure carries its detail', (d.detail ?? '').includes('offline'));

  console.log('\n=== 5. A CLEAN RESOLUTION ACTUALLY SWITCHES ===');
  // The assertion that would have failed if the switch were wired up as
  // observability only, the way `curriculum_source` is (see that module's
  // header: `a1Path.ts` snapshots constants at import time, so it cannot be).
  __resetLessonRenderResolution();
  __setReaderForTest(flagIs('run'));
  const run = await resolveLessonRenderOnce();
  check('it switched to run', run.render === 'run', run.render);
  check('the renderer is run', getLessonRender() === 'run');
  check('the read is observable', getLessonRenderRead()?.render === 'run');
  check('the clean read is mirrored to the cache', localStorage.getItem(LESSON_RENDER_CACHE_KEY) === 'run');

  console.log('\n=== 6. SWITCHING BACK IS POSSIBLE ===');
  // A switch that cannot be turned back is not a rollout, it is a migration.
  __setReaderForTest(flagIs('legacy'));
  const back = await resolveLessonRenderOnce();
  check('it switched back to legacy', back.render === 'legacy');
  check('the renderer is legacy', getLessonRender() === 'legacy');
  check('the cache follows the rollback', localStorage.getItem(LESSON_RENDER_CACHE_KEY) === 'legacy');

  console.log('\n=== 7. SUBSCRIBERS ARE NOTIFIED ON CHANGE ONLY ===');
  __resetLessonRenderResolution();
  let fired = 0;
  const unsubscribe = subscribeLessonRender(() => {
    fired += 1;
  });
  __setReaderForTest(flagIs('run'));
  await resolveLessonRenderOnce();
  check('a change notifies subscribers', fired === 1, `fired ${fired}`);
  // Re-reading the same value is not a change, so subscribers must not churn.
  await resolveLessonRenderOnce();
  check('an unchanged re-read does not notify', fired === 1, `fired ${fired}`);
  unsubscribe();
  __setReaderForTest(flagIs('legacy'));
  await resolveLessonRenderOnce();
  check('an unsubscribed listener is not called', fired === 1, `fired ${fired}`);

  console.log('\n=== 8. STARTING IS IDEMPOTENT AND SAFE ===');
  __resetLessonRenderResolution();
  __setReaderForTest(flagIs('run'));
  startLessonRenderResolution();
  startLessonRenderResolution();
  startLessonRenderResolution();
  check('repeated starts do not throw', true);
  await new Promise((r) => setTimeout(r, 0));
  check('the renderer is always one of the two', ['legacy', 'run'].includes(getLessonRender()));

  console.log('\n=== 9. A FAILED READ IS NOT A ROLLBACK ===');
  // A failed read is not new information. If it moved the renderer, a momentary
  // blip would swap the learner's content out from under them mid-session, and
  // the read would then disagree with the render — the worst state for an
  // operator answering "why is this learner seeing the old page?".
  __resetLessonRenderResolution();
  __setReaderForTest(flagIs('run'));
  await resolveLessonRenderOnce();
  check('a clean read is in force', getLessonRender() === 'run');
  __setReaderForTest(() => Promise.reject(new Error('flaky')));
  const failed = await resolveLessonRenderOnce();
  check('the failed read is reported', failed.reason === 'flag-unreadable');
  check('the last known-good renderer still stands', getLessonRender() === 'run', getLessonRender());
  check('the cache still holds run', localStorage.getItem(LESSON_RENDER_CACHE_KEY) === 'run');
  // A value that is present but not in the vocabulary is equally not new
  // information — an operator typo must not downgrade a live rollout either.
  __setReaderForTest(flagIs('rnu'));
  await resolveLessonRenderOnce();
  check('an unrecognised value does not move the renderer', getLessonRender() === 'run');
  check('it is reported as unreadable', getLessonRenderRead()?.reason === 'flag-unreadable');

  console.log('\n=== 10. THE FLOOR IS ALWAYS REACHABLE ===');
  // Clearing the CACHE, not just the store: `__reset` deliberately returns to
  // whatever the real app would show, which is the cached value if there is one.
  // The invariant worth pinning is the cold start — no flag, no cache — because
  // that is the state of every learner on their first visit after a deploy.
  localStorage.clear();
  __resetLessonRenderResolution();
  check('a cold start with no flag and no cache is legacy', getLessonRender() === 'legacy');
  __setReaderForTest(flagIs('run'));
  await resolveLessonRenderOnce();
  check('it can reach run', getLessonRender() === 'run');
  localStorage.clear();
  __resetLessonRenderResolution();
  check('and clearing the cache brings it back to legacy', getLessonRender() === 'legacy');

  console.log(
    `\n[summary] ${failures.length === 0 ? 'ALL' : ''} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`,
  );
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
})();
