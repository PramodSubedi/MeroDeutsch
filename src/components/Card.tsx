import type { ReactNode } from 'react';
import { theme } from '../config/theme';

interface CardProps {
  badge: ReactNode;
  title: string;
  lines: string[];
  footer?: string;
  note?: string;
  onClick?: () => void;
  onSpeak?: () => void;
}

export function Card({ badge, title, lines, footer, note, onClick, onSpeak }: CardProps) {
  const content = (
    <>
      <span className={theme.card.badge}>{badge}</span>
      <span className="min-w-0 flex-1">
        <span className={`${theme.card.title} block`}>{title}</span>
        {lines.map((line, index) => (
          <span key={`${index}:${line}`} className={`${theme.card.line} block`}>{line}</span>
        ))}
        {footer && <span className={`${theme.card.footer} block`}>{footer}</span>}
        {note && <span className={`${theme.card.note} block`}>{note}</span>}
      </span>
    </>
  );

  return (
    <article className={theme.card.surface}>
      <div className="flex items-center gap-3">
        {onClick ? (
          <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {content}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
        )}
        {onSpeak && (
          <button type="button" onClick={onSpeak} className={theme.button.icon} aria-label={`Play audio for ${title}`}>
            🔊
          </button>
        )}
      </div>
    </article>
  );
}
