/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind v4 — CSS-based config lives in src/index.css (@theme, @custom-variant).
  // This JS config is ONLY for safelist: classes that the dev-server JIT misses
  // because they're constructed via string concatenation in TS (see AppSidebar.tsx
  // `activeClass()`). The build-time scanner finds them, but the dev-server's
  // on-demand JIT does not always flush them — producing a flash-of-un-darked
  // active nav pill. Safelisting forces generation in both dev and production.
  safelist: [
    // Active sidebar nav pill (light + dark + before: accent bar)
    'bg-white',
    'font-semibold',
    'text-blue-700',
    'shadow-sm',
    'ring-1',
    'ring-slate-200',
    'before:absolute',
    'before:left-0',
    'before:top-1/2',
    'before:h-5',
    'before:w-1',
    'before:-translate-y-1/2',
    'before:rounded-full',
    'before:bg-blue-600',
    'dark:bg-slate-800/70',
    'dark:text-blue-300',
    'dark:ring-slate-700/60',
    'dark:before:bg-blue-400',
    // Idle sidebar nav pill (dark hover states)
    'text-slate-600',
    'hover:bg-slate-100/70',
    'hover:text-slate-900',
    'dark:text-slate-300',
    'dark:hover:bg-slate-800/70',
    'dark:hover:text-white',
  ],
};
