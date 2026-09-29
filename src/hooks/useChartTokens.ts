/**
 * src/hooks/useChartTokens.ts
 *
 * CSS custom properties as REACT values, for the charting libraries.
 *
 * WHY THIS EXISTS
 * ---------------
 * Recharts, and SVG in general, take colours as attributes/props — they do not
 * participate in Tailwind's cascade, so a `dark:` class on a wrapper cannot
 * reach a `<PolarGrid stroke="...">`. That is why `SkillRadarChart` carried
 * FIVE hardcoded hexes (`#2563eb`, `#94a3b8`, `#64748b`, `#f8fafc`): it had no
 * way to do anything else, and the result was a chart that stayed light in dark
 * mode — a slate grid and dark tooltip on a near-black card.
 *
 * `var(--x)` DOES work for most of these, but not reliably for every prop
 * recharts passes through to the DOM, and a silent black-on-black chart is
 * worse than a slightly heavier hook. So the token is read once per theme
 * change and handed over as a plain string.
 *
 * WHY NOT JUST READ ONCE AT MODULE LOAD
 * ------------------------------------
 * The value differs between light and dark, and the first read would happen
 * before `useDarkMode` has written the `dark` class. Reading on every theme
 * change keeps the chart correct on the very first paint of either theme.
 *
 * The token names below all exist in `index.css`'s `@theme` block. A missing
 * one returns `''`, and recharts treats that as "no colour", so a typo degrades
 * to a default rather than throwing.
 */
import { useEffect, useState } from 'react';
import { useDarkMode } from './useDarkMode';

/** The tokens the charts need, as literal colour strings. */
export interface ChartTokens {
  /** Primary series / fill — the brand accent. */
  accent: string;
  /** Positive outcome. */
  success: string;
  /** Needs attention. */
  warning: string;
  /** Muted axis + grid lines, light mode. */
  grid: string;
  /** Axis label text, light mode. */
  axis: string;
  /** Tooltip surface. */
  tooltipBg: string;
  /** Tooltip text. */
  tooltipText: string;
  /** Tooltip hairline. */
  tooltipBorder: string;
}

const CSS_VARS = {
  accent: '--color-accent-500',
  success: '--color-success-500',
  warning: '--color-warning-500',
  grid: '--color-ink-200',
  axis: '--color-ink-500',
  tooltipBg: '--color-ink-900',
  // `--color-white` does NOT exist: the app's `text-white` is Tailwind's
  // built-in, not a project token, so it has no CSS custom property to read.
  // `ink-50` is the lightest step in the scale the project does define, and
  // is what the app's own dark surfaces use for their foreground.
  tooltipText: '--color-ink-50',
  tooltipBorder: '--color-ink-700',
} as const satisfies Record<keyof ChartTokens, string>;

const DARK_VARS = {
  grid: '--color-ink-800',
  axis: '--color-ink-400',
  tooltipBg: '--color-ink-800',
  tooltipBorder: '--color-ink-700',
} as const;

function readVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Reads the token set for a theme. A plain function, NOT a `useCallback`:
 * a hook cannot be called at module top level, and a `useCallback` here would
 * have an empty dependency array anyway, so it would memoise nothing useful.
 * The effect below lists `dark` explicitly instead, which is the dependency
 * that actually matters — the only way this can go stale is `dark` changing,
 * and that is exactly what is watched.
 */
function read(dark: boolean): ChartTokens {
  // Typed as a partial: only four tokens have a dark-mode override, so the
  // lookup below is intentionally optional.
  const overrides: Partial<Record<keyof ChartTokens, string>> = dark ? DARK_VARS : {};
  const out = {} as ChartTokens;
  for (const key of Object.keys(CSS_VARS) as (keyof ChartTokens)[]) {
    out[key] = readVar(overrides[key] ?? CSS_VARS[key]);
  }
  return out;
}

export function useChartTokens(): ChartTokens {
  const { dark } = useDarkMode();
  // Lazy initialiser so the FIRST paint already has real values, rather than an
  // empty object that a chart would draw as "no colour".
  const [tokens, setTokens] = useState<ChartTokens>(() => read(dark));

  useEffect(() => {
    // `useDarkMode` applies the `dark` class in its own effect, which runs
    // before this one (declaration order in the tree), so by the time this fires
    // the class is on <html> and the read returns the right theme's values.
    setTokens(read(dark));
  }, [dark]);

  return tokens;
}
