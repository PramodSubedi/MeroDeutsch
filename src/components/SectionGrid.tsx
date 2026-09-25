import type { ReactNode } from 'react';
import { theme } from '../config/theme';

interface SectionGridProps {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
  /** Skip the title/description header block (page already renders its own heading). */
  hideHeader?: boolean;
  /**
   * Heading level for the section title. Defaults to 'h2' because SectionGrid
   * is always a SECTION inside a page that renders its own <h1> — it used to
   * hardcode <h1>, which produced two page-level headings on every page that
   * showed the header.
   */
  titleAs?: 'h2' | 'h3';
}

export function SectionGrid({ title, description, controls, children, hideHeader = false, titleAs: TitleTag = 'h2' }: SectionGridProps) {
  return (
    <div>
      {!hideHeader && (
        <div className={theme.section.surface}>
          <TitleTag className={theme.section.title}>{title}</TitleTag>
          <p className={theme.section.description}>{description}</p>
          {controls && <div className={theme.section.controls}>{controls}</div>}
        </div>
      )}
      {hideHeader && controls && <div className={`${theme.section.controls} mb-2`}>{controls}</div>}
      <div className={theme.section.grid}>{children}</div>
    </div>
  );
}
