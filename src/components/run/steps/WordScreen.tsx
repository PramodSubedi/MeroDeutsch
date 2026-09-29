/**
 * src/components/run/steps/WordScreen.tsx
 *
 * A batch of `word` steps on one screen.
 *
 * ── WHY A LIST AND NOT CARDS ─────────────────────────────────────────────────
 * The data is one step per word because that is what the CONTENT needs — audio,
 * the active/passive distinction and the example all hang off the individual
 * entry. It is not a statement about pacing. Fourteen sequential cards meant
 * thirteen clicks that taught nothing, and a learner who already knows a word
 * still had to click through it.
 *
 * The list is now forty-odd words in most lessons, after the document lexicon was
 * merged into the authored ones, so the layout is built for that: dense rows, one
 * tap to hear, one tap to reveal, and the reveal FLIPS so it registers as a card
 * turning rather than as text appearing.
 *
 * ── WHY THE TRANSLATION IS REVEALED RATHER THAN SHOWN ───────────────────────
 * Showing EN and Nepali next to every German word turns the screen into a list
 * the learner reads instead of a test they perform. Tapping to reveal keeps the
 * recall — and the tap is a useful action, which is what the click in the
 * one-card-per-step version never was.
 *
 * ── WHY THE FIRST WORD SPEAKS ITSELF ─────────────────────────────────────────
 * The learner arrived from a click on "Continue" or from answering an exercise,
 * so their attention is on the app rather than on a list. One word speaking when
 * the screen opens tells them the list is audio rather than decoration, and gives
 * them a model to repeat before reading anything.
 *
 * Only the FIRST word auto-plays. Audio a learner did not ask for is a nuisance
 * by the second one, and a list of forty words all speaking at once is noise.
 * Every other word has an explicit button beside it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../../hooks/useLang';
import { genderTokenFor } from '../../../config/theme';
import { AudioButton } from '../../AudioButton';
import { speakText } from '../../../hooks/useSpeech';
import type { WordStep } from '../../../data/curriculum/steps';

const CARD = 'rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900';

/** The reveal animation, declared once so it is not re-created per row. */
const FLIP_KEYFRAMES = `
@keyframes word-flip {
  from { opacity: 0; transform: rotateX(-55deg); }
  to   { opacity: 1; transform: rotateX(0deg); }
}`;

/** Read the motion preference once. The flip is decoration and must not cost anyone comfort. */
function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The article, in the locked gender colour.
 *
 * `genderTokenFor` centralises the der/die → dieF mapping so no call site invents
 * its own hex — the same discipline the theme's own note demands, and the reason a
 * brand refresh cannot leave one surface showing a different pink.
 */
function GenderArticle({ article }: { article: string }) {
  const token = genderTokenFor(article);
  return <span className={`text-base font-semibold ${token.text} ${token.darkText}`}>{article}</span>;
}

/**
 * The plural, in the PLURAL token.
 *
 * A separate colour from the singular because "die" means two different things —
 * feminine singular and plural — and German learners conflate them constantly.
 * Painting both pink would hide the very distinction the colour exists to teach.
 */
function PluralTag({ entry }: { entry: WordStep['entry'] }) {
  const token = genderTokenFor('plural');
  return (
    <span className={`text-sm ${token.text} ${token.darkText}`}>
      <span className="opacity-60">pl. </span>
      {entry.plural}
    </span>
  );
}

export function WordScreen({ steps }: { steps: WordStep[] }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const spokeOnce = useRef(false);
  const reduced = useMemo(prefersReducedMotion, []);

  const activeCount = steps.filter((s) => s.active).length;

  useEffect(() => {
    if (spokeOnce.current || steps.length === 0) return;
    spokeOnce.current = true;
    // The headword only — a full example sentence spoken on arrival is a lecture.
    speakText(steps[0].entry.word);
  }, [steps]);

  const toggle = (i: number) =>
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // The most recently opened row animates; the rest are simply shown. Tracking it
  // by index rather than with a timeout means a row reopened later flips again,
  // which is the behaviour a card-turn metaphor implies.
  const justOpened = useMemo(() => {
    let latest = -1;
    for (const i of revealed) if (i > latest) latest = i;
    return latest;
  }, [revealed]);

  return (
    <section className={CARD} aria-label={isDE ? 'Vokabeln' : 'Vocabulary'}>
      <style>{FLIP_KEYFRAMES}</style>

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
          {isDE ? 'Vokabeln' : 'Vocabulary'}
          <span className="ml-2 text-sm font-normal text-ink-500 dark:text-ink-400">{steps.length}</span>
        </h2>
        {activeCount > 0 ? (
          <p className="text-micro font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-400">
            {activeCount} {isDE ? 'aktiv' : 'active'}
          </p>
        ) : null}
      </div>

      <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
        {steps.map((s, i) => {
          const entry = s.entry;
          const open = revealed.has(i);
          return (
            <li key={`${entry.word}-${i}`} className="py-1.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={open}
                  className="min-h-[44px] flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                >
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    {/* The article in the LOCKED gender colour.
                        `.clinerules` Part E1 freezes those four values because this
                        is the only place in the app where colour carries meaning —
                        and for a beginner the article IS the word's identity, not
                        a label. Rendering it in muted grey threw away the app's own
                        pedagogical system and made every noun look the same. */}
                    {entry.article && entry.article !== 'plural' ? (
                      <GenderArticle article={entry.article} />
                    ) : null}
                    <span className="text-lg text-ink-900 dark:text-ink-50">{entry.word}</span>
                    {entry.plural ? <PluralTag entry={entry} /> : null}
                    {/* IPA is a pronunciation aid, not content to read, so it is
                        set small and dim beside the word rather than under it. */}
                    {entry.ipa ? (
                      <span className="font-mono text-xs text-ink-400 dark:text-ink-500">{entry.ipa}</span>
                    ) : null}
                  </span>

                  {/*
                    Rendered even when closed, and hidden with `hidden` rather than
                    not mounted. That is what lets the print stylesheet force it
                    visible: a word whose translation only appears on tap is a word
                    the printed page never reveals, and a handout is exactly what
                    someone prints. The `hidden` class is overridden by the
                    `.nb-reveal` print rule.
                  */}
                  <span
                    className={`nb-reveal mt-1 ${open ? 'block' : 'hidden'}`}
                    style={{
                      transformOrigin: 'top center',
                      animation: !reduced && justOpened === i ? 'word-flip 200ms ease-out' : undefined,
                    }}
                  >
                    {/* `LexiconEntry` has no German gloss field — the German IS
                        the headword. English and Nepali are the two bridge
                        languages, shown together rather than instead. */}
                    <span className="block text-sm text-ink-800 dark:text-ink-100">{entry.en}</span>
                    {entry.ne && entry.ne !== entry.en ? (
                      <span className="mt-0.5 block text-sm text-ink-600 dark:text-ink-300">{entry.ne}</span>
                    ) : null}
                    {entry.examples?.[0] ? (
                      <span className="mt-1.5 block border-l-2 border-ink-200 pl-2 dark:border-ink-700">
                        <span lang="de" className="block text-sm text-ink-800 dark:text-ink-100">
                          {entry.examples[0].de}
                        </span>
                        <span className="block text-sm text-ink-600 dark:text-ink-300">{entry.examples[0].en}</span>
                      </span>
                    ) : null}
                  </span>
                </button>
                <AudioButton word={entry.word} lang="de" className="shrink-0" />
              </div>
              {s.active ? (
                <p className="mt-0.5 text-micro font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-400">
                  {isDE ? 'Aktiv — selbst benutzen' : 'Active — you produce this'}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
