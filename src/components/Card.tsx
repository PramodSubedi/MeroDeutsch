import type { ReactNode } from 'react';
import { theme } from '../config/theme';

interface CardProps {
  badge: ReactNode;
  title: string;
  lines: string[];
  footer?: string;
  note?: string;
  onClick?: () => void;
  onSpeak: () => void;
}

export function Card({ badge, title, lines, footer, note, onClick, onSpeak }: CardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      className={theme.card.surface}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex cursor-pointer items-center gap-3">
        <div className={theme.card.badge}>{badge}</div>
        <div className="min-w-0 flex-1">
          <div className={theme.card.title}>{title}</div>
          {lines.map((line) => (
            <div key={line} className={theme.card.line}>
              {line}
            </div>
          ))}
          {footer && <div className={theme.card.footer}>{footer}</div>}
          {note && <div className={theme.card.note}>{note}</div>}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSpeak();
          }}
          className={theme.button.icon}
          aria-label={`Play audio for ${title}`}
        >
          🔊
        </button>
      </div>
    </div>
  );
}
