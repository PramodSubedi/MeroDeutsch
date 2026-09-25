import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message ?? 'Something went wrong.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled React error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4 py-8 text-ink-900 dark:bg-ink-950 dark:text-ink-100">
          <div className="max-w-xl rounded-lg bg-white p-8 shadow-xl dark:bg-ink-900">
            <h1 className="text-2xl font-semibold">Oops! Ein Fehler ist aufgetreten.</h1>
            <p className="mt-4 text-body text-ink-600 dark:text-ink-400">
              Die Anwendung kann gerade nicht geladen werden. Bitte lade die Seite neu oder versuche es später erneut.
            </p>
            {this.state.errorMessage && (
              <div className="mt-4 rounded-lg bg-ink-100 p-4 text-body text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                {this.state.errorMessage}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="rounded-full bg-accent-600 px-4 py-2 text-body font-semibold text-white hover:bg-accent-700"
              >
                Seite neu laden
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
