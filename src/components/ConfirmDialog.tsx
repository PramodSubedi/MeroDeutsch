import { useEffect, useRef } from 'react';
import { theme } from '../config/theme';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  // Phone: a bottom sheet. Desktop: the centred dialog. Both render the SAME
  // dialog element and the SAME focus/Escape behaviour — only the wrapper and
  // the corner treatment differ, so there is no second implementation of a
  // destructive action to keep in step.
  //
  // The action row STACKS on a phone. Two side-by-side buttons in a 380px sheet
  // give each ~150px, which is workable, but stacking gives each the full width
  // and — more importantly — separates the safe choice from the destructive one
  // by a whole row.
  return (
    <div
      className={`${theme.modal.sheetOverlay} sm:items-start sm:justify-center sm:p-4`}
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className={`${theme.modal.sheet} overscroll-contain-y max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag affordance. Decorative only — the sheet is dismissed by the
            backdrop, the Cancel button or Escape, never by this handle, so it
            must not imply a drag gesture the component does not implement. */}
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-300 sm:hidden dark:bg-ink-700"
        />
        <h2 id="confirm-title" className="text-title font-bold text-ink-900 dark:text-ink-100">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-body text-ink-600 dark:text-ink-300">
          {message}
        </p>
        {/* `flex-col`, NOT `flex-col-reverse`. The row is `mt-6` — the action
            nearest the thumb on a sheet is the one a reflexive tap lands on, and
            that must be Cancel, not the destructive action. `flex-col-reverse`
            visually reorders the row so "Clear reviews" sits on top, which is
            exactly backwards. From `sm` up the row becomes a normal
            `flex-row`, so Cancel stays left and Confirm stays right as before. */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end sm:gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`${theme.button.secondary} w-full sm:w-auto`}
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`${theme.button.danger} w-full sm:w-auto`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
