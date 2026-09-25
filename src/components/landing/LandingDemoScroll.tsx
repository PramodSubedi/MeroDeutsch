/**
 * src/components/landing/LandingDemoScroll.tsx
 *
 * "See it in action" — a pinned, scroll-driven product chapter.
 *
 * Story (desktop, scroll-scrubbed):
 *   p 0.00-0.15  Deck: five feature cards, one auto-highlighted at a time
 *   p 0.15-0.35  Cards scale down / drift up / fade — "assembling the app"
 *   p 0.35-0.50  A single browser frame grows to full width
 *   p 0.50-0.90  Scripted demo plays inside the frame (5 scenes, scrub by scroll):
 *                home daily loop -> A1 band spine -> gender articles -> review + tools -> sign-in gate
 *   p 0.90-1.00  Settle: final caption + real CTAs (Start learning / Sign in)
 *
 * Product rules baked into the script: guests get the daily loop + tools; the guided
 * A1 bands and checkpoint gates are the signed-in payoff (scene 5). Scenes are static
 * mocks (aria-hidden, non-interactive) — the only real links are the final CTAs.
 *
 * Implementation notes:
 *  - Progress comes from getBoundingClientRect() on the section inside a
 *    PASSIVE window scroll handler (no rAF indirection): scroll events are
 *    already coalesced per frame by the browser, and rAF-driven updates
 *    silently never fire in occluded/background tabs (which froze the earlier
 *    framer-motion AND rAF-throttled variants during automated checks). The
 *    epsilon guard below prevents redundant renders.
 *  - Desktop-only, reduced-motion-safe: below lg or with
 *    prefers-reduced-motion the chapter renders as a static frame with demo
 *    scene 1 + CTAs (no pin, no transforms). QA hook: append ?motion=1 to
 *    bypass the reduced-motion preference (width gate still applies).
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
BookOpen, CheckCircle, Flame, Home, Lock,
  Mic, PenLine, Route, RotateCcw, Target, Trophy, Zap,
} from 'lucide-react';
import { theme } from '../../config/theme';
import { useLang } from '../../hooks/useLang';

const FORCE_MOTION =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('motion');

/** Deck cards: chapter markers mirroring the five scripted demo scenes. */
const DECK = [
  {
    icon: Home,
    title: { en: 'Daily loop', de: 'Tages-Rhythmus' },
    sub: { en: 'Warm-up · Push · Challenge', de: 'Warm-up · Push · Challenge' },
  },
  {
    icon: Route,
    title: { en: 'A1 campaign', de: 'A1-Kampagne' },
    sub: { en: '6 bands, 80% gates', de: '6 Bänder, 80%-Pforten' },
  },
  {
    icon: BookOpen,
    title: { en: 'Gender articles', de: 'Artikel & Genus' },
    sub: { en: 'der · die · das colors', de: 'der · die · das mit Farbe' },
  },
  {
    icon: RotateCcw,
    title: { en: 'Review + tools', de: 'Wiederholung + Tools' },
    sub: { en: 'Misses come back · Blitz', de: 'Fehler kommen zurück · Blitz' },
  },
  {
    icon: Lock,
    title: { en: 'Guided path', de: 'Geführter Pfad' },
    sub: { en: 'Sign in to unlock', de: 'Anmelden zum Freischalten' },
  },
] as const;

/** Captions for the five scripted demo scenes (scrubbed by scroll). */
const STEPS = [
  { cap: { en: "Your daily loop — start today's session", de: 'Dein Tages-Rhythmus — Sitzung heute starten' } },
  { cap: { en: 'One band at a time — gates at ≥80%', de: 'Band für Band — Pforten bei ≥80%' } },
  { cap: { en: 'Pick the right article — colors teach gender', de: 'Den richtigen Artikel wählen — Farbe lehrt Genus' } },
  { cap: { en: 'Review misses come back + quick tools', de: 'Fehler kommen zurück + schnelle Tools' } },
  { cap: { en: 'Unlock the guided path — sign in', de: 'Geführten Pfad freischalten — anmelden' } },
] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function LandingDemoScroll() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const sectionRef = useRef<HTMLElement>(null);

  // Desktop-only, reduced-motion-safe gate for the scroll-linked transforms.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAnimate(mq.matches && (FORCE_MOTION || !rm.matches));
    update();
    mq.addEventListener('change', update);
    rm.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
      rm.removeEventListener('change', update);
    };
  }, []);

  // Scroll progress across the section: 0 = top enters viewport bottom,
  // 1 = bottom reaches viewport bottom (sticky releases).
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!animate) {
      setProgress(0);
      return;
    }
    const update = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, (vh - rect.top) / Math.max(1, rect.height)));
      setProgress((prev) => (Math.abs(prev - p) < 0.001 ? prev : p));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [animate]);

  // Deck auto-highlight (phase-1 visual sugar; skipped when static).
  const [deckHot, setDeckHot] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => setDeckHot((h) => (h + 1) % DECK.length), 1600);
    return () => window.clearInterval(id);
  }, [animate]);

  // ---- Phase math (all derived from progress; no motion library) ---------
  const deckT = clamp01((progress - 0.15) / 0.2);          // 0 -> 1 while collapsing
  const deckStyle: CSSProperties | undefined = animate
    ? {
        opacity: (1 - deckT).toFixed(3),
        transform: `scale(${(1 - 0.18 * deckT).toFixed(4)}) translateY(${(-24 * deckT).toFixed(1)}px)`,
        willChange: 'transform, opacity',
      }
    : undefined;

  const frameOp = clamp01((progress - 0.35) / 0.12);       // fade-in
  const frameIn = clamp01((progress - 0.35) / 0.15);       // grow + rise
  const frameStyle: CSSProperties | undefined = animate
    ? {
        opacity: frameOp.toFixed(3),
        transform: `scale(${(0.72 + 0.28 * frameIn).toFixed(4)}) translateY(${(40 * (1 - frameIn)).toFixed(1)}px)`,
        willChange: 'transform, opacity',
        pointerEvents: frameOp > 0.5 ? 'auto' : 'none',
      }
    : undefined;

  const step = animate ? Math.min(4, Math.floor(clamp01((progress - 0.5) / 0.4) * 5)) : 0;
  const showSettle = animate ? clamp01((progress - 0.9) / 0.07) : 1;

  return (
    <section
      ref={sectionRef}
      aria-label={isDE ? 'Produkt-Demo' : 'Product demo'}
      className="relative"
    >
      {/* Section header — scrolls normally before the stage pins */}
      <div className="mx-auto max-w-6xl px-4 pt-16 text-center sm:px-6">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-meta font-semibold text-accent-700 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-300">
          {isDE ? 'Produkt-Demo' : 'Product demo'}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl dark:text-white">
          {isDE ? 'Sieh es in Aktion' : 'See it in action'}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-body leading-7 text-ink-600 dark:text-ink-300">
          {isDE
            ? 'Weiter scrollen — die Funktionen verbinden sich zur App und zeigen eine echte Lernsitzung.'
            : 'Keep scrolling — the features assemble into the app and walk through a real session.'}
        </p>
      </div>

      {/* Tall scroll range (desktop) — defines how long the stage stays pinned */}
      <div className="relative lg:h-[240vh]">
        <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:py-0">
          <div className="relative mx-auto h-full w-full max-w-6xl">

            {/* ---- LAYER 1: feature deck (phases 1-2) ---- */}
            {animate ? (
              <div
                aria-hidden="true"
                style={deckStyle}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {DECK.map((card, i) => (
                    <div
                      key={card.title.en}
                      className={`rounded-lg border bg-white p-4 shadow-lg transition-all duration-500 dark:bg-ink-900 ${
                        i === deckHot
                          ? 'border-accent-400 shadow-accent-900/10 ring-2 ring-accent-500/30 dark:border-accent-500'
                          : 'border-ink-200 dark:border-ink-800'
                      }`}
                    >
                      <card.icon className="h-6 w-6 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                      <p className="mt-2.5 text-body font-bold text-ink-900 dark:text-white">
                        {isDE ? card.title.de : card.title.en}
                      </p>
                      <p className="mt-1 text-meta leading-5 text-ink-500 dark:text-ink-400">
                        {isDE ? card.sub.de : card.sub.en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ---- LAYER 2: app frame + scripted demo (phases 3-5) ---- */}
            <div
              style={frameStyle ?? { opacity: 1 }}
              className="relative z-10 mx-auto flex max-w-4xl flex-col items-center"
            >
              {/* Ambient brand glow behind the assembled frame */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-accent-500/15 via-accent-400/10 to-transparent blur-2xl"
              />

              {/* Browser chrome */}
              <div className="w-full rounded-t-lg border border-b-0 border-ink-200 bg-white px-4 py-2.5 dark:border-ink-800 dark:bg-ink-800">
                <div className="flex items-center gap-3">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-danger-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success-400" />
                  </span>
                  <span className="mx-auto flex min-w-0 items-center gap-1.5 rounded-sm border border-ink-200 bg-white px-3 py-1 text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">
                    <Lock className="h-3 w-3 shrink-0 text-success-500" aria-hidden="true" />
                    <span className="truncate text-[11px] font-medium">
                      merodeutsch.app
                      <span className="text-ink-500 dark:text-ink-500">/welcome</span>
                    </span>
                  </span>
                  <span className="w-10" aria-hidden="true" />
                </div>
              </div>

              {/* Screen: five scripted scenes, cross-faded by scroll */}
              <div className="relative h-[360px] w-full overflow-hidden rounded-b-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                {[0, 1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    aria-hidden="true"
                    style={{ opacity: s === step ? 1 : 0 }}
                    className="pointer-events-none absolute inset-0 p-6 transition-opacity duration-300"
                  >
                    {s === 0 && <SceneHome isDE={isDE} />}
                    {s === 1 && <ScenePath isDE={isDE} />}
                    {s === 2 && <SceneArticles isDE={isDE} />}
                    {s === 3 && <SceneReview isDE={isDE} />}
                    {s === 4 && <SceneGate isDE={isDE} />}
                  </div>
                ))}
              </div>

              {/* Bottom strip: step caption+dots, cross-fading to the final CTA */}
              <div className="relative mt-4 h-[76px] w-full">
                <div
                  style={{ opacity: animate ? 1 - showSettle : 0 }}
                  className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2"
                >
                  <p className="text-body font-semibold text-ink-700 dark:text-ink-200">
                    {isDE ? STEPS[step].cap.de : STEPS[step].cap.en}
                  </p>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === step ? 'w-5 bg-accent-600 dark:bg-accent-400' : 'w-1.5 bg-ink-300 dark:bg-ink-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div
                  style={{ opacity: showSettle, pointerEvents: showSettle > 0.5 ? 'auto' : 'none' }}
                  className="absolute inset-x-0 top-0 flex flex-col items-center gap-3"
                >
                  <p className="text-body font-semibold text-ink-700 dark:text-ink-200">
                    {isDE ? 'Bereit für Ihre erste A1-Sitzung?' : 'Ready for your first A1 session?'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/home"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-accent-600 px-6 py-2.5 text-body font-semibold text-white shadow-lg shadow-accent-600/25 transition hover:bg-accent-700 active:scale-95"
                    >
                      {isDE ? 'Kostenlos starten' : 'Start learning free'}
                    </Link>
                    <Link
                      to="/auth"
                      className="inline-flex min-h-[44px] items-center rounded-md border border-ink-300 px-6 py-2.5 text-body font-semibold text-ink-700 transition hover:bg-ink-50 active:scale-95 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                    >
                      {isDE ? 'Anmelden' : 'Sign in'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Scripted demo scenes (static mocks) ---------------- */

function SceneHome({ isDE }: { isDE: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 pb-2.5 dark:border-ink-800">
        <span className="text-body font-black text-accent-600 dark:text-accent-400">MeroDeutsch</span>
        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
          <Flame className="h-3 w-3 text-warning-500" aria-hidden="true" /> {isDE ? '3-Tage-Strähne' : '3-day streak'}
        </span>
      </div>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-meta font-bold text-white shadow-lg shadow-accent-600/25"
      >
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        {isDE ? "Starte die heutige Sitzung" : "Start today's session"}
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold text-white">5</span>
      </button>
      <div className="mt-2.5 flex-1 space-y-2">
          <div className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-800 dark:bg-ink-800/50">
          <span className="inline-flex items-center gap-1.5 text-meta font-bold text-ink-700 dark:text-ink-200">
            <RotateCcw className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            {isDE ? 'Warm-up' : 'Warm-up'}
          </span>
          <span className="rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-bold text-success-700 dark:bg-success-950/60 dark:text-success-300">
            5 {isDE ? 'fällig' : 'due'}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-800 dark:bg-ink-800/50">
          <span className="inline-flex items-center gap-1.5 text-meta font-bold text-ink-700 dark:text-ink-200">
            <Route className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            {isDE ? 'Push' : 'Push'}
          </span>
          <span className="text-[10px] font-semibold text-ink-500 dark:text-ink-400">
            {isDE ? 'Weiter: Grüße' : 'Next: Greetings'}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-800 dark:bg-ink-800/50">
          <span className="inline-flex items-center gap-1.5 text-meta font-bold text-ink-700 dark:text-ink-200">
            <Zap className="h-3.5 w-3.5 text-warning-500 dark:text-warning-400" aria-hidden="true" /> {isDE ? 'Herausforderung' : 'Challenge'}
          </span>
          <span className="text-[10px] font-semibold text-ink-500 dark:text-ink-400">Rapid Blitz</span>
        </div>
      </div>
    </div>
  );
}

function ScenePath({ isDE }: { isDE: boolean }) {
  const bands = [
    { code: 'A', en: 'First Contact', de: 'Erster Kontakt', state: 'done' },
    { code: 'B', en: 'Script & Sound', de: 'Schrift & Klang', state: 'support' },
    { code: 'C', en: 'Name the World', de: 'Die Welt benennen', state: 'current' },
    { code: 'D', en: 'Time & Routine', de: 'Zeit & Alltag', state: 'locked' },
    { code: 'E', en: 'Situations', de: 'Situationen', state: 'locked' },
    { code: 'F', en: 'Control & Accuracy', de: 'Präzision & Aussprache', state: 'locked' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="text-body font-bold text-ink-900 dark:text-white">
          {isDE ? 'Dein A1-Lernpfad' : 'Your A1 path'}
        </span>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
          {isDE ? 'Pforte: ≥80%' : 'Gate: ≥80%'}
        </span>
      </div>
      <div className="mt-3 flex-1 space-y-1.5">
        {bands.map((b) => (
          <div
            key={b.code}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-meta ${
              b.state === 'done'
                ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-900/40 dark:bg-success-950/30 dark:text-success-300'
                : b.state === 'current'
                  ? 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900/40 dark:bg-accent-950/30 dark:text-accent-300'
                  : b.state === 'support'
                    ? 'border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400'
                    : 'border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-500'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                b.state === 'done'
                  ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
                  : b.state === 'current'
                    ? 'bg-accent-600 text-white'
                    : b.state === 'support'
                      ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
                      : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
              }`}
            >
              {b.state === 'done' ? <CheckCircle className="h-3 w-3" aria-hidden="true" /> : b.code}
            </span>
            <span className="flex-1 truncate font-semibold">{isDE ? b.de : b.en}</span>
            {b.state === 'done' && (
              <span className="text-[10px] font-bold text-success-600 dark:text-success-400">80%</span>
            )}
            {b.state === 'current' && (
              <span className="text-[10px] font-bold text-accent-600 dark:text-accent-300">
                {isDE ? 'aktuell' : 'current'}
              </span>
            )}
            {b.state === 'locked' && <Lock className="h-3 w-3 text-ink-500" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneArticles({ isDE }: { isDE: boolean }) {
  const articles = [
    { key: 'der', token: theme.gender.der },
    { key: 'die', token: theme.gender.dieF },
    { key: 'das', token: theme.gender.das },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="text-body font-bold text-ink-900 dark:text-white">
          {isDE ? 'Artikel · Einheit C' : 'Articles · Unit C'}
        </span>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
          der · die · das
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-ink-200 bg-ink-50 p-4 text-center dark:border-ink-800 dark:bg-ink-800/50">
        <span className="text-2xl font-bold text-ink-900 dark:text-white">Tisch</span>
        <span className="text-meta text-ink-500 dark:text-ink-400">{isDE ? 'Welcher Artikel?' : 'Which article?'}</span>
        <div className="mt-1 flex gap-2">
          {articles.map((a) => (
            <span
              key={a.key}
              className={`inline-flex items-center gap-1 rounded-sm border-2 px-4 py-1.5 text-meta font-bold ${a.token.text} ${a.token.darkText} ${a.token.border} ${
                a.key === 'der' ? 'ring-2 ring-offset-1 ring-accent-600/30' : 'opacity-70'
              }`}
            >
              {a.key === 'der' && <CheckCircle className="h-3 w-3" aria-hidden="true" />}
              {a.key}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5 text-[10px] font-semibold text-ink-500 dark:text-ink-400">
          {articles.map((a) => (
            <span key={a.key} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${a.token.bg}`} aria-hidden="true" /> {a.key}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${theme.gender.diePl.bg}`} aria-hidden="true" /> pl
          </span>
        </div>
      </div>
    </div>
  );
}

function SceneReview({ isDE }: { isDE: boolean }) {
  const rows = [
    { w: 'der Tisch', ok: true },
    { w: 'danke', ok: true },
    { w: 'das Wasser', ok: false },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-2.5">
        <Trophy className="h-5 w-5 text-warning-500" aria-hidden="true" />
        <span className="rounded-full bg-accent-600 px-2 py-0.5 text-[11px] font-bold text-white">XP 320</span>
      </div>
      <div className="w-full max-w-sm space-y-1.5">
        {rows.map((r) => (
          <div key={r.w} className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3.5 py-2 dark:border-ink-800 dark:bg-ink-800/50">
            <span className="text-body font-semibold text-ink-700 dark:text-ink-200">{r.w}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              r.ok
                ? 'bg-success-100 text-success-700 dark:bg-success-950/60 dark:text-success-300'
                : 'bg-warning-100 text-warning-700 dark:bg-warning-950/60 dark:text-warning-300'
            }`}>
              {r.ok ? '✓' : isDE ? 'morgen' : 'tomorrow'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {[
          { icon: Zap, label: 'Rapid Blitz' },
          { icon: Mic, label: isDE ? 'Sprechen' : 'Speak' },
          { icon: PenLine, label: isDE ? 'Diktat' : 'Dictation' },
        ].map((t) => (
          <div key={t.label} className="flex flex-1 flex-col items-center gap-1 rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5 dark:border-ink-800 dark:bg-ink-800/50">
            <t.icon className="h-4 w-4 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            <span className="text-[10px] font-bold text-ink-700 dark:text-ink-200">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneGate({ isDE }: { isDE: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-lg bg-accent-50 dark:bg-accent-950/50">
        <Lock className="h-6 w-6 text-accent-600 dark:text-accent-400" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold text-ink-900 dark:text-white">
        {isDE ? 'Geführter A1-Pfad' : 'Guided A1 path'}
      </span>
      <p className="max-w-xs text-meta leading-5 text-ink-500 dark:text-ink-400">
        {isDE
          ? 'Fortschritt speichern · synchronisieren · Kontrollpunkte freischalten'
          : 'Save progress · sync across devices · unlock checkpoints'}
      </p>
      <span className="mt-1 inline-flex items-center rounded-md bg-accent-600 px-5 py-2 text-meta font-bold text-white">
        {isDE ? 'Anmelden' : 'Sign in'}
      </span>
    </div>
  );
}

