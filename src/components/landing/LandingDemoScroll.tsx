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
 *                guest module grid -> lesson -> smart review -> tools -> sign-in gate
 *   p 0.90-1.00  Settle: final caption + real CTAs (Start learning / Sign in)
 *
 * Product rules baked into the script: guests get modules + tools; the guided
 * path is introduced as the sign-in step (step 5). Scenes are static mocks
 * (aria-hidden, non-interactive) — the only real links are the final CTAs.
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
  BookOpen, CalendarDays, Hash, Library,
  Lock, MessagesSquare, Mic, PenLine, RotateCcw, Route, ScrollText,
  Type, Volume2, Wrench, Zap,
} from 'lucide-react';
import { useLang } from '../../hooks/useLang';

const FORCE_MOTION =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('motion');

/** Deck cards: chapter markers mirroring the five scripted demo scenes. */
const DECK = [
  {
    icon: BookOpen,
    title: { en: 'A1 modules', de: 'A1-Module' },
    sub: { en: 'Explore free', de: 'Gratis entdecken' },
  },
  {
    icon: PenLine,
    title: { en: 'Live lesson', de: 'Live-Lektion' },
    sub: { en: 'Learn by doing', de: 'Lernen durch Machen' },
  },
  {
    icon: RotateCcw,
    title: { en: 'Smart review', de: 'Smarte Wiederholung' },
    sub: { en: 'Misses come back', de: 'Fehler kommen zurück' },
  },
  {
    icon: Wrench,
    title: { en: 'Practice tools', de: 'Übungswerkzeuge' },
    sub: { en: 'Blitz · speak · dictation', de: 'Blitz · Sprechen · Diktat' },
  },
  {
    icon: Route,
    title: { en: 'Guided path', de: 'Geführter Pfad' },
    sub: { en: 'Sign in to unlock', de: 'Anmelden zum Freischalten' },
  },
] as const;

/** Captions for the five scripted demo scenes (scrubbed by scroll). */
const STEPS = [
  { cap: { en: 'Explore A1 lessons free', de: 'A1-Lektionen kostenlos entdecken' } },
  { cap: { en: 'Learn by doing', de: 'Lernen durch Machen' } },
  { cap: { en: 'Misses come back', de: 'Fehler kommen zurück' } },
  { cap: { en: 'Practice tools', de: 'Übungswerkzeuge' } },
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
        <p className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          {isDE ? 'Produkt-Demo' : 'Product demo'}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
          {isDE ? 'Sieh es in Aktion' : 'See it in action'}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
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
                      className={`rounded-2xl border bg-white p-4 shadow-lg transition-all duration-500 dark:bg-slate-900 ${
                        i === deckHot
                          ? 'border-blue-400 shadow-blue-900/10 ring-2 ring-blue-500/30 dark:border-blue-500'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <card.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                      <p className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white">
                        {isDE ? card.title.de : card.title.en}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
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
              {/* Browser chrome */}
              <div className="w-full rounded-t-2xl border border-b-0 border-slate-200 bg-slate-100 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="mx-auto rounded-md bg-white px-3 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    merodeutsch.app
                  </span>
                  <span className="w-10" aria-hidden="true" />
                </div>
              </div>

              {/* Screen: five scripted scenes, cross-faded by scroll */}
              <div className="relative h-[360px] w-full overflow-hidden rounded-b-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                {[0, 1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    aria-hidden="true"
                    style={{ opacity: s === step ? 1 : 0 }}
                    className="pointer-events-none absolute inset-0 p-6 transition-opacity duration-300"
                  >
                    {s === 0 && <SceneGuestHome isDE={isDE} />}
                    {s === 1 && <SceneLesson isDE={isDE} />}
                    {s === 2 && <SceneReview isDE={isDE} />}
                    {s === 3 && <SceneTools isDE={isDE} />}
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
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isDE ? STEPS[step].cap.de : STEPS[step].cap.en}
                  </p>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === step ? 'w-5 bg-blue-600 dark:bg-blue-400' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div
                  style={{ opacity: showSettle, pointerEvents: showSettle > 0.5 ? 'auto' : 'none' }}
                  className="absolute inset-x-0 top-0 flex flex-col items-center gap-3"
                >
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isDE ? 'Bereit für Ihre erste A1-Sitzung?' : 'Ready for your first A1 session?'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/home"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-95"
                    >
                      {isDE ? 'Kostenlos starten' : 'Start learning free'}
                    </Link>
                    <Link
                      to="/auth"
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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

function SceneGuestHome({ isDE }: { isDE: boolean }) {
  const mods = [
    { icon: MessagesSquare, label: isDE ? 'Grüße' : 'Greetings' },
    { icon: Type, label: 'Alphabet' },
    { icon: Hash, label: isDE ? 'Zahlen' : 'Numbers' },
    { icon: CalendarDays, label: isDE ? 'Kalender' : 'Calendar' },
    { icon: Library, label: isDE ? 'Artikel' : 'Articles' },
    { icon: ScrollText, label: isDE ? 'Geschichten' : 'Stories' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <span className="text-sm font-black text-blue-600 dark:text-blue-400">MeroDeutsch</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {isDE ? 'Gast-Modus' : 'Guest mode'}
        </span>
      </div>
      <div className="mt-4 grid flex-1 grid-cols-3 gap-2.5">
        {mods.map((m) => (
          <div key={m.label} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
            <m.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneLesson({ isDE }: { isDE: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900 dark:text-white">
          {isDE ? 'Grüße · Lektion 2' : 'Greetings · Lesson 2'}
        </span>
        <span className="text-xs font-semibold text-slate-400">40%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-[40%] rounded-full bg-blue-600" />
      </div>
      <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-800/50">
        <span className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          Guten Morgen!
          <Volume2 className="h-5 w-5 text-blue-500" aria-hidden="true" />
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">शुभ प्रभात</span>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {['Guten Tag', 'Gute Nacht', 'Danke'].map((o, i) => (
            <span
              key={o}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                i === 0
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {o}
            </span>
          ))}
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
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2.5">
        <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="text-base font-bold text-slate-900 dark:text-white">
          {isDE ? 'Smarte Wiederholung' : 'Smart review'}
        </span>
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">5</span>
      </div>
      <div className="w-full max-w-sm space-y-2">
        {rows.map((r) => (
          <div key={r.w} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{r.w}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                r.ok
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {r.ok ? '✓' : isDE ? 'morgen' : 'tomorrow'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneTools({ isDE }: { isDE: boolean }) {
  const tools = [
    { icon: Zap, label: 'Rapid Blitz' },
    { icon: Mic, label: isDE ? 'Sprechen' : 'Speak' },
    { icon: PenLine, label: isDE ? 'Diktat' : 'Dictation' },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="text-base font-bold text-slate-900 dark:text-white">
        {isDE ? 'Übungswerkzeuge' : 'Practice tools'}
      </span>
      <div className="flex gap-3">
        {tools.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/50">
            <t.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneGate({ isDE }: { isDE: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-950/50">
        <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold text-slate-900 dark:text-white">
        {isDE ? 'Geführter A1-Pfad' : 'Guided A1 path'}
      </span>
      <p className="max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
        {isDE
          ? 'Fortschritt speichern · synchronisieren · Kontrollpunkte freischalten'
          : 'Save progress · sync across devices · unlock checkpoints'}
      </p>
      <span className="mt-1 inline-flex items-center rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white">
        {isDE ? 'Anmelden' : 'Sign in'}
      </span>
    </div>
  );
}
