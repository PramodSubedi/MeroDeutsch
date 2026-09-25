import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Languages, Smartphone, Sparkles, Target } from 'lucide-react';
import { theme } from '../config/theme';
import { Footer } from '../components/Footer';
import { Logo } from '../components/common/Logo';
import { LanguageToggle } from '../components/LanguageToggle';
import { JourneyRibbon } from '../components/landing/JourneyRibbon';
import { BenefitsPanel } from '../components/landing/BenefitsPanel';
import { HeroVisual } from '../components/landing/HeroVisual';
import { LandingDemoScroll } from '../components/landing/LandingDemoScroll';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';

/** Marketing landing — why join / what it is. Hands off to Guest Home (`/home`). */
export function LandingPage() {
  usePageTitle('Learn German from zero — with Nepali support');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Small entrance (hero fade/rise) — the global CSS kills it under
    // prefers-reduced-motion, so no duplicate guard needed here.
    const id = window.setTimeout(() => setVisible(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  const t = {
    eyebrow: 'MeroDeutsch · A1',
    h1: isDE ? 'Deutsch von null lernen — mit nepalesischer Unterstützung' : 'Learn German from zero — with Nepali support',
    sub: isDE
      ? 'Geführte A1-Lektionen, intelligente Wiederholung und Übungs-Tools — kostenlos testen, ohne Konto.'
      : 'Guided A1 lessons, smart review, and practice tools — try free, no account required.',
    ne: 'नेपाली बोल्नेहरूका लागि पनि — अंग्रेजी + नेपाली सहयोग',
    tryFree: isDE ? 'Kostenlos starten' : 'Start learning',
    signIn: isDE ? 'Anmelden' : 'Sign in',
    // Slim pill row between hero and demo — the full value props live in the
    // hero cards, the benefit panel and the journey ribbon below.
    trust: isDE
      ? ['Kostenlos testen', 'Kein Konto nötig', 'English + नेपाली', 'Geführter A1-Pfad']
      : ['Free to try', 'No account needed', 'English + नेपाली', 'Guided A1 path'],
    featuresHeading: isDE ? 'Was Sie bekommen' : 'What you get',
    featuresSub: isDE
      ? 'Geführter Pfad, zweisprachige Hilfe, kluge Wiederholung und echte Statistiken — kein zufälliges Lektionsmenü.'
      : 'Guided path, bilingual help, smart review, and real stats — not a random lesson menu.',
    howSub: isDE
      ? 'Vom ersten Klick bis zum geführten Pfad — vier Schritte.'
      : 'From first click to your guided path — four steps.',
    whomHeading: isDE ? 'Für wen' : 'For whom',
    whomSub: isDE
      ? 'Gemacht für Nepalis und Englischsprachige, die Deutsch von null lernen.'
      : 'Built for Nepali and English speakers starting German.',
    whom: [
      {
        icon: Sparkles,
        title: isDE ? 'Anfänger (A1)' : 'Beginners (A1)',
        line: isDE ? 'Starten Sie bei null — kein Vorwissen nötig.' : 'Start from zero — no prior German needed.',
      },
      {
        icon: Languages,
        title: isDE ? 'Nepali-Sprecher' : 'Nepali speakers',
        line: isDE ? 'Erklärungen auf Englisch + Nepali.' : 'Explanations in English + Nepali.',
      },
      {
        icon: Target,
        title: isDE ? 'Im eigenen Tempo' : 'Self-paced',
        line: isDE ? 'Kontrollpunkte geben das Tempo vor.' : 'Checkpoint gates set your pace.',
      },
      {
        icon: Smartphone,
        title: isDE ? 'Mobil & Desktop' : 'Mobile & desktop',
        line: isDE ? 'Üben Sie auf jedem Gerät.' : 'Practice on any device.',
      },
    ],
    closingTitle: isDE ? 'Bereit, wenn Sie es sind.' : 'Ready when you are.',
    closingLine: isDE ? 'Starten Sie als Gast in einem Klick.' : 'Start as a guest in one click.',
    privacy: isDE ? 'Keine Kreditkarte, keine Verpflichtung.' : 'No credit card, no commitment.',
  };

  // NOTE: deliberately NO overflow-x-clip/-hidden on this wrapper — ANY
  // non-visible overflow on an ancestor makes framer-motion resolve that
  // element as useScroll's "scroll container", which never scrolls, freezing
  // scrollYProgress in <LandingDemoScroll/> below (transforms stay at their
  // initial values). Hero decorations are contained by the hero section's own
  // overflow-hidden instead; nothing else on this page overflows horizontally.
  return (
    <div className={`${theme.layout.app} min-h-screen`}>
      <SEO
        title="Learn German from zero — with Nepali support | MeroDeutsch"
        description="Guided A1 lessons, article & article training, speaking practice, and smart review — try free as a guest, no account required."
      />
{/* Minimal landing header — not the app shell */}
      <header className="sticky top-0 z-50 h-16 border-b border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/welcome" aria-label="MeroDeutsch – Home" className="inline-flex h-9 items-center rounded-sm transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none">
            <Logo size="sm" variant="navbar" />
          </Link>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <ThemeToggle />
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
        <section className="relative overflow-hidden bg-gradient-to-br from-ink-50 via-white to-accent-50 dark:from-ink-950 dark:via-ink-950 dark:to-ink-900">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:items-center">
            <div className={visible ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : 'opacity-0'}>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-meta font-semibold text-accent-700 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t.eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl dark:text-white">
                {t.h1}
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-7 text-ink-600 dark:text-ink-300">
                {t.sub}
              </p>
              {/* Nepali helper line — hidden in Nur-DE mode */}
              {!isDE && (
                <p lang="ne" className="nepali-text mt-2 text-body text-ink-500 dark:text-ink-400">
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

            {/* Hero visual — floating feature-card collage (six glass cards) */}
            <div className="relative">
              <HeroVisual />
            </div>
          </div>
          </section>
{/* TRUST STRIP — slim pill row (details live in the cards below) */}
        <section className="border-y border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
            {t.trust.map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center gap-2 text-body font-semibold text-ink-600 dark:text-ink-300"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />
                {pill}
              </span>
            ))}
          </div>
        </section>

        {/* PRODUCT DEMO — ConceptZilla-style scroll-linked expansion: all 5 hero
            concepts mounted once, pinned + scaled up as the user scrolls, then
            held for interaction (desktop); static grid on mobile/reduced-motion. */}
        <LandingDemoScroll />

        {/* WHAT YOU GET — split benefit panel (typical apps vs MeroDeutsch) */}
        <section className="bg-white dark:bg-ink-900">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-white">
              {t.featuresHeading}
            </h2>
            <p className="mt-2 max-w-2xl text-body text-ink-500 dark:text-ink-400 sm:text-body">
              {t.featuresSub}
            </p>
            <div className="mt-8 flex justify-center">
              <BenefitsPanel />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — journey ribbon (guest → modules → sign in → path) */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-white">
            {isDE ? 'So funktioniert es' : 'How it works'}
          </h2>
          <p className="mt-2 text-body text-ink-500 dark:text-ink-400 sm:text-body">{t.howSub}</p>
          <div className="mt-10 flex justify-center">
            <JourneyRibbon />
          </div>
        </section>

        {/* FOR WHOM — audience mini-cards */}
        <section className="bg-white dark:bg-ink-900">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">{t.whomHeading}</h2>
            <p className="mt-2 text-body text-ink-500 dark:text-ink-400 sm:text-body">{t.whomSub}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.whom.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-lg border border-ink-200 bg-ink-50 p-5 dark:border-ink-800 dark:bg-ink-800/60"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-body font-semibold text-ink-900 dark:text-white">{item.title}</h3>
                    <p className="mt-1 text-body text-ink-500 dark:text-ink-400">{item.line}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FINAL CTA — compact banner */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-accent-50 p-6 dark:bg-accent-950/30 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">{t.closingTitle}</h2>
              <p className="mt-1 text-body text-ink-600 dark:text-ink-300 sm:text-body">{t.closingLine}</p>
              <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">{t.privacy}</p>
            </div>
            <Link
              to="/home"
              className={`${theme.button.primary} inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 px-8`}
            >
              {t.tryFree}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}