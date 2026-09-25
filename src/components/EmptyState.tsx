import { Link } from 'react-router-dom';
import { theme } from '../config/theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
  onSecondaryAction?: () => void;
}

/**
 * Reusable empty state component with optional CTAs.
 * Prevents UX dead-ends by providing clear next actions.
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryActionLabel,
  secondaryActionTo,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50 p-8 text-center dark:border-ink-700 dark:bg-ink-900">
      <div className="mx-auto mb-4 text-5xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-ink-900 dark:text-white">
        {title}
      </h3>
      <p className="mb-6 text-body leading-relaxed text-ink-600 dark:text-ink-300">
        {description}
      </p>
      
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap justify-center gap-3">
          {actionLabel && (
            actionTo ? (
              <Link to={actionTo} className={`${theme.button.primary} px-6 py-3`}>
                {actionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className={`${theme.button.primary} px-6 py-3`}
              >
                {actionLabel}
              </button>
            )
          )}
          
          {secondaryActionLabel && (
            secondaryActionTo ? (
              <Link to={secondaryActionTo} className={`${theme.button.secondary} px-6 py-3`}>
                {secondaryActionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onSecondaryAction}
                className={`${theme.button.secondary} px-6 py-3`}
              >
                {secondaryActionLabel}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
