/**
 * src/components/ui/Field.tsx
 *
 * Label + control + optional hint/error, so forms stop hand-rolling their own
 * label markup. The control inherits `theme.input`; callers pass their own
 * input props through `...rest`.
 */
import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { theme } from '../../config/theme';

const LABEL = 'block text-meta font-semibold text-ink-700 dark:text-ink-300';
const HINT = 'mt-1.5 text-micro text-ink-500 dark:text-ink-400';
const ERROR = 'mt-1.5 text-micro font-medium text-danger-600 dark:text-danger-400';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div>
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? <p className={ERROR}>{error}</p> : hint ? <p className={HINT}>{hint}</p> : null}
    </div>
  );
}

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  /** Presence of an error (even empty) switches the control to error styling. */
  error?: string;
};

export function Field({ label, hint, error, className = '', ...rest }: FieldProps) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${theme.input} ${error ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100 dark:border-danger-800' : ''} ${className}`}
      />
    </FieldShell>
  );
}

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextareaField({ label, hint, error, className = '', ...rest }: TextareaFieldProps) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <textarea
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${theme.input} min-h-24 resize-y ${error ? 'border-danger-400 focus:border-danger-500' : ''} ${className}`}
      />
    </FieldShell>
  );
}
