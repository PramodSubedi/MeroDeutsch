/**
 * src/admin/components/ReadBoundary.tsx
 *
 * A minimal error boundary for the admin's data panels.
 *
 * ── WHY THE SHELL NEEDED ONE ────────────────────────────────────────────────
 * Eight read models were moved onto Postgres functions that do not exist in any
 * database yet. A rejected promise in a `useEffect` unmounts the whole React
 * tree by default, so a single missing function took the entire control centre
 * with it — a blank white page rather than a control centre with one broken
 * panel.
 *
 * The read models now fall back when a function is ABSENT (see `data/rpc.ts`),
 * which removes the immediate cause. This boundary is the backstop for the
 * general case: a panel that throws for any reason should cost you that panel,
 * not the navigation, the palette and everything else.
 *
 * ── WHY IT IS LOCAL RATHER THAN A DEPENDENCY ────────────────────────────────
 * `react-error-boundary` is not installed, and adding a runtime dependency for
 * roughly forty lines is a trade this codebase has been declining all along —
 * it is why the RPC fallback and this boundary are both hand-rolled. The
 * alternative is not "no boundary", it is "no boundary until someone installs
 * one", which is the state this was just in.
 *
 * Class-based because `getDerivedStateFromError` and `componentDidCatch` have no
 * hook equivalent, and a hook-based "boundary" is not one.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LEGACY_PATH_NOTICE } from '../data/rpc';

interface Props {
  /** A human name for the panel, so the error says WHICH panel failed. */
  label: string;
  children: ReactNode;
  /** Rendered instead of the default panel. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ReadBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Logged rather than shown only. A panel that fails once in production and
    // is then reset by the user should still leave a trace.
    console.error(`[admin] ${this.props.label} failed to render`, error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <section
        role="alert"
        className="rounded-lg border border-danger-300 bg-danger-50 p-4 dark:border-danger-900 dark:bg-danger-950/40"
      >
        <h2 className="flex items-center gap-2 text-section font-bold text-danger-900 dark:text-danger-200">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {this.props.label} could not be displayed
        </h2>
        <p className="mt-1 text-meta text-danger-800 dark:text-danger-300">
          The rest of the control centre is unaffected. {error.message}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-md border border-danger-300 bg-white px-3 text-meta font-semibold text-danger-800 hover:bg-danger-50 dark:border-danger-800 dark:bg-ink-900 dark:text-danger-200"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    );
  }
}

/**
 * A one-line banner for the whole shell when a read model is on its fallback.
 *
 * Degraded mode is VISIBLE. The legacy reads are correct but bounded, and a
 * number produced under a cap is a different kind of claim from the same number
 * computed by `COUNT(*)`. An operator should be able to tell which they have
 * without opening the console.
 */
export function DegradedModeBanner({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-warning-200 bg-warning-50 p-3 text-meta text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
    >
      <p className="font-semibold">Running on the older read path</p>
      <p className="mt-1">{LEGACY_PATH_NOTICE}</p>
      {messages.length > 0 && (
        <ul className="mt-1 list-inside list-disc">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
