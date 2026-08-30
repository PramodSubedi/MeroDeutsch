import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Flag,
  GraduationCap,
  Languages,
  Mic,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
  Zap,
} from 'lucide-react';
import { theme } from '../config/theme';
import { Footer } from '../components/Footer';
import { Logo } from '../components/common/Logo';
import { LanguageToggle } from '../components/LanguageToggle';
import { LandingHero } from '../components/landing/LandingHero';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';

const LANDING_SEEN_KEY = 'meroDeutschLandingSeenV1';

/** Marketing landing — why join / what it is. Hands off to Guest Home (`/home`). */
export function LandingPage() {
  usePageTitle('Learn German from zero — with Nepali support');
  const { dark, toggle: toggleDark } = useDarkMode();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Returning-logged-out visitors (or anyone who clicked through once) can jump
  // straight to the guest Home; the flag is set silently on mount.
  useEffect(() => {
    try {
      localStorage.setItem(LANDING_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Small entrance (hero fade/rise) — the global CSS kills it under
    // prefers-reduced-motion, so no duplicate guard needed here.
    const id = window.setTimeout(() => setVisible(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  // How-it-works copy reflects the split: guests _explore_ A1 lessons; the
  // linear checkpoint path is a sign-in-gated benefit, not a guest feature.
  const how = isDE
    ? [
        { title: 'Kostenlos ausprobieren', line: 'Starten Sie als Gast — kein Konto nötig.' },
        { title: 'A1-Lektionen entdecken', line: 'Arbeiten Sie direkt mit Alphabet, Zahlen, Artikeln.' },
        { title: 'Anmelden für den geführten Pfad', line: 'Ihr Fortschritt wird gespeichert, inkl. Wiederholdungen.' },
      ]
    : [
        { title: 'Try free', line: 'Start as a guest — no account needed.' },
        { title: 'Explore A1 lessons', line: 'Jump straight into alphabet, numbers, articles.' },
        { title: 'Sign in for guided path', line: 'Progress saved + smart review of mistakes.' },
      ];

  const t = {
    eyebrow: 'MeroDeutsch · A1',
    h1: isDE ? 'Deutsch von null lernen — mit nepalesischer Unterstützung' : 'Learn German from zero — with Nepali support',
    sub: isDE
      ? 'Geführte A1-Lektionen, intelligente Wiederholung und Übungs-Tools — kostenlos testen, ohne Konto.'
      : 'Guided A1 lessons, smart review, and practice tools — try free, no account required.',
    ne: 'नेपाली बोल्नेहरूका लागि पनि — अंग्रेजी + नेपाली सहयोग',
    tryFree: isDE ? 'Kostenlos starten' : 'Start learning',
    signIn: isDE ? 'Anmelden' : 'Sign in',
    trust: [
      { icon: GraduationCap, title: isDE ? 'Geführter A1-Pfad' : 'Guided A1 path', line: isDE ? 'Schritt für Schritt, nicht ein zufälliges Menü.' : 'Step-by-step units, not a random menu.' },
      { icon: Languages, title: isDE ? 'Nepali + Englisch' : 'Nepali + English', line: isDE ? 'Erklärungen in der Sprache, die Sie verstehen.' : 'Explanations in the language you understand.' },
      { icon: RefreshCw, title: isDE ? 'Intelligente Wiederholung' : 'Smart review', line: isDE ? 'Verpasste Punkte kommen gezielt wieder.' : 'Missed items come back on purpose.' },
    ],
    featuresHeading: isDE ? 'Was Sie bekommen' : 'What you get',
    features: [
      { icon: Flag, title: isDE ? 'A1-Lernpfad' : 'A1 learning path', line: isDE ? 'Einheiten in fester Reihenfolge mit Checkpoints.' : 'Units in a fixed order with checkpoints.' },
      { icon: BookOpen, title: isDE ? 'Artikel & Wörter' : 'Articles & words', line: isDE ? 'der/die/das mit klarem Üben.' : 'der/die/das with clear practice.' },
      { icon: Mic, title: isDE ? 'Sprechen & Rollenspiel' : 'Speaking & role-play', line: isDE ? 'Alltagsdialoge von Anfang an.' : 'Everyday dialogues from day one.' },
      { icon: RefreshCw, title: isDE ? 'Review-Queue' : 'Review queue', line: isDE ? 'Verpasste Items kommen gezielt zurück.' : 'Missed items come back on purpose.' },
      { icon: Zap, title: isDE ? 'Blitz-Quizze' : 'Blitz quizzes', line: isDE ? 'Schnelle Übungen für unterwegs.' : 'Fast drills for on the go.' },
      { icon: BarChart3, title: isDE ? 'Fortschritt & Statistiken' : 'Progress & stats', line: isDE ? 'Sehen Sie, was Sie schon können.' : 'See what you already know.' },
    ],
    howHeading: isDE ? 'So funktioniert’s' : 'How it works',
    // NOTE: `how` is an ARRAY — spread it as a named property (not `...how`,
    // which would splat it into numeric keys and break `t.how.map(...)`).
    how,
    whomHeading: isDE ? 'Für wen' : 'For whom',
    whom: isDE
      ? ['Anfänger (A1)', 'Nepali-Sprecher', 'Selbststudium', 'Mobil & Desktop']
      : ['Beginners (A1)', 'Nepali speakers', 'Self-paced', 'Mobile & desktop'],
    closingTitle: isDE ? 'Bereit, wenn Sie es sind.' : 'Ready when you are.',
    closingLine: isDE ? 'Starten Sie als Gast in einem Klick.' : 'Start as a guest in one click.',
    privacy: isDE ? 'Keine Kreditkarte, keine Verpflichtung.' : 'No credit card, no commitment.',
  };

  return (
    <div className={`${theme.layout.app} min-h-screen overflow-x-hidden`}>
      <SEO
        title="Learn German from zero — with Nepali support | MeroDeutsch"
        description="Guided A1 lessons, article & article training, speaking practice, and smart review — try free as a guest, no account required."
      />
{/* Minimal landing header — not the app shell */}
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/welcome" aria-label="MeroDeutsch – Home" className="inline-flex h-9 items-center rounded-lg transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
            <Logo size="sm" variant="navbar" />
          </Link>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <button
              type="button"
              onClick={toggleDark}
              className={theme.layout.themeButton}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <Link
              to="/auth"
              className={`${theme.button.secondary} hidden sm:inline-flex`}
            >
              {t.signIn}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:items-center">
            <div className={visible ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : 'opacity-0'}>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t.eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
                {t.h1}
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-7 text-slate-600 dark:text-slate-300">
                {t.sub}
              </p>
              {/* Nepali helper line — hidden in Nur-DE mode */}
              {!isDE && (
                <p lang="ne" className="nepali-text mt-2 text-base text-slate-500 dark:text-slate-400">
                  {t.ne}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/home"
                  className={`${theme.button.primary} inline-flex min-h-[48px] items-center justify-center gap-2 sm:px-8`}
                >
                  {t.tryFree}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link
                  to="/auth"
                  className={`${theme.button.secondary} inline-flex min-h-[48px] items-center justify-center gap-2 sm:px-6`}
                >
                  {t.signIn}
                </Link>
              </div>
            </div>

            {/* Hero visual — switchable concept (A–E): ?hero= param, VITE_LANDING_HERO env, default A */}
            <div className="relative hidden lg:block" aria-hidden="true">
              <LandingHero />
            </div>
          </div>
          </section>
{/* TRUST STRIP */}
        <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
            {t.trust.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.line}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FEATURES (bento) */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {t.featuresHeading}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.features.map((item, i) => {
              const Icon = item.icon;
              const wide = i === 0;
              return (
                <div
                  key={item.title}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${wide ? 'md:col-span-2 lg:col-span-1' : ''}`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.line}</p>
                </div>
              );
            })}
          </div>

          {/* HOW IT WORKS */}
          <div className="mt-16">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.howHeading}
            </h3>
            <div className="mt-6 grid gap-8 md:grid-cols-3">
              {t.how.map((step, i) => (
                <div key={step.title} className="relative">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{step.title}</h4>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{step.line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOR WHOM */}
        <section className="bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.whomHeading}</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {t.whom.map((w) => (
                <span key={w} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  {w}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-blue-50 p-8 text-center sm:p-12 dark:bg-blue-950/30">
            <Target className="mx-auto h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {t.closingTitle}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-base text-slate-600 dark:text-slate-300">{t.closingLine}</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/home" className={`${theme.button.primary} inline-flex min-h-[48px] items-center justify-center gap-2 px-8`}>
                {t.tryFree}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t.privacy}</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}