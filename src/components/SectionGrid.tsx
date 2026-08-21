import type { ReactNode } from 'react';
import { theme } from '../config/theme';

interface SectionGridProps {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
  /** Skip the title/description header block (page already renders its own heading). */
  hideHeader?: boolean;
}

export function SectionGrid({ title, description, controls, children, hideHeader = false }: SectionGridProps) {
  return (
    <div>
      {!hideHeader && (
        <div className={theme.section.surface}>
          <h1 className={theme.section.title}>{title}</h1>
          <p className={theme.section.description}>{description}</p>
          {controls && <div className={theme.section.controls}>{controls}</div>}
        </div>
      )}
      {hideHeader && controls && <div className={`${theme.section.controls} mb-2`}>{controls}</div>}
      <div className={theme.section.grid}>{children}</div>
    </div>
  );
}
