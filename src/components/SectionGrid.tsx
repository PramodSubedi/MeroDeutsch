import type { ReactNode } from 'react';
import { theme } from '../config/theme';

interface SectionGridProps {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
}

export function SectionGrid({ title, description, controls, children }: SectionGridProps) {
  return (
    <div>
      <div className={theme.section.surface}>
        <h1 className={theme.section.title}>{title}</h1>
        <p className={theme.section.description}>{description}</p>
        {controls && <div className={theme.section.controls}>{controls}</div>}
      </div>
      <div className={theme.section.grid}>{children}</div>
    </div>
  );
}
