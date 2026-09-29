/**
 * src/admin/components/SearchPalette.tsx
 *
 * The global Ctrl/⌘K palette.
 *
 * ── WHY IT SEARCHES IN-MEMORY DATA ─────────────────────────────────────────
 * See `data/search.ts`. The alternative — a query per keystroke — would make the
 * fastest interaction in the tool the slowest, and needs debouncing and
 * cancellation for what is, at most, 1,062 rows already in memory.
 *
 * The honest consequence: results are only as fresh as what the index holds, so
 * `onOpen` is called on open and the SHELL decides whether a rebuild is due. Each
 * hit navigates to the page that CAN filter for it, and both of those pages read
 * the `?q=` parameter — which they did not until the deep link was wired, so
 * every one of these links used to land on an unfiltered table.
 *
 * ── KEYBOARD AND FOCUS, DONE PROPERLY ──────────────────────────────────────
 * The hotkey is bound on `window` with `preventDefault` so it does not also fire
 * a browser action, the input takes focus on open, and focus is RESTORED to the
 * previously focused element on close. Without that last step the palette
 * strands keyboard users at the top of the document after one use.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CornerDownLeft, Search } from 'lucide-react';
import { isDismissKey, isOpenHotkey, searchAll, type SearchGroup, type SearchHit } from '../data/search';

const GROUP_LABEL: Record<SearchGroup, string> = {
  navigation: 'Go to',
  users: 'Users',
  vocabulary: 'Vocabulary',
  audit: 'Audit',
  content: 'Content pool',
  unit: 'Curriculum unit',
};

export function SearchPalette({
  index,
  onOpen,
  errors,
}: {
  index: Parameters<typeof searchAll>[0];
  /** Called each time the palette opens, so the shell can rebuild if stale. */
  onOpen?: () => void;
  /** Which index sources failed to load. Shown, not swallowed. */
  errors?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  // A DEFERRED query. `unitDocText` walks every unit document on each scan, so
  // typing at speed queued a full document walk per keystroke and the results
  // trailed the caret. Deferring lets React drop intermediate queries when the
  // next keystroke arrives first.
  const deferredQuery = useDeferredValue(query);
  const hits = useMemo(() => searchAll(index, deferredQuery), [index, deferredQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    // Return focus where it was, or the palette becomes a keyboard dead end.
    restoreRef.current?.focus?.();
  }, []);

  const go = useCallback((hit: SearchHit) => {
    setOpen(false);
    setQuery('');
    navigate(hit.to);
  }, [navigate]);

  // `onOpen` is read through a ref rather than listed as an effect dependency.
  // The shell passes an inline `useCallback` whose identity is stable, but the
  // keydown listener is registered ONCE and must not be torn down and rebuilt
  // whenever the shell re-renders — the hotkey has to work the instant it is
  // pressed, and a torn-down listener is a hotkey that silently does nothing.
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isOpenHotkey(e)) {
        e.preventDefault();
        if (open) return;
        restoreRef.current = document.activeElement as HTMLElement | null;
        setOpen(true);
        setActive(0);
        onOpenRef.current?.();
        // Focus after the render that mounts the input.
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      if (!open) return;
      if (isDismissKey(e.key)) {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => (hits.length === 0 ? 0 : (a + 1) % hits.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (hits.length === 0 ? 0 : (a - 1 + hits.length) % hits.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const hit = hits[active];
        if (hit) go(hit);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hits, active, close, go]);

  // Keep the highlighted row valid as the result list changes underneath it.
  useEffect(() => {
    setActive((a) => (a >= hits.length ? 0 : a));
  }, [hits.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/40 p-4 pt-[10vh]"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the admin control centre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <div className="flex items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
          <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, users, vocabulary, audit…"
            aria-label="Search"
            className="w-full bg-transparent py-3 text-body text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-50"
          />
          <kbd className="shrink-0 rounded border border-ink-200 px-1.5 py-0.5 font-mono text-micro text-ink-500 dark:border-ink-700 dark:text-ink-400">
            Esc
          </kbd>
        </div>

        {errors && errors.length > 0 && (
          <p
            role="status"
            className="flex items-start gap-2 border-b border-warning-200 bg-warning-50 px-3 py-2 text-meta text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Part of the index could not be loaded, so these results are incomplete:{' '}
              {errors.join('; ')}
            </span>
          </p>
        )}

        {hits.length === 0 ? (
          <p className="px-3 py-6 text-center text-body text-ink-500 dark:text-ink-400">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
            {hits.map((hit, i) => (
              <li key={hit.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  // `onMouseDown` fires before the input's blur, so the click is
                  // not lost to focus moving away first.
                  onMouseDown={(e) => { e.preventDefault(); go(hit); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                    i === active ? 'bg-ink-100 dark:bg-ink-800' : ''
                  }`}
                >
                  <span className="w-20 shrink-0 text-micro uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    {GROUP_LABEL[hit.group]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink-900 dark:text-ink-50">{hit.title}</span>
                    {hit.subtitle && (
                      <span className="block truncate text-meta text-ink-500 dark:text-ink-400">{hit.subtitle}</span>
                    )}
                  </span>
                  {i === active && <CornerDownLeft className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
