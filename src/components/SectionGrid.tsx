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
  /**
   * Render children WITHOUT the `theme.section.grid` wrapper.
   *
   * WHY THIS EXISTS
   * The default wrapper is a responsive grid (`grid-cols-1 md:grid-cols-2
   * lg:grid-cols-3`) and the component's normal contract is an ARRAY of cards
   * as children, which fills those columns correctly.
   *
   * A caller that passes ONE element containing its own grid nests a grid
   * inside a grid. The inner element is then not a card but a single grid ITEM,
   * so it is placed in column 1 only — one third of the width at `lg` — and its
   * own columns divide that third. That is a real bug this component shipped:
   * the lesson pages passed `<div className="grid gap-3 sm:grid-cols-2">` and
   * every vocabulary card rendered ~90px wide with the right two thirds of the
   * page empty and long words splitting mid-word.
   *
   * So: pass `bare` when the children bring their own layout, and keep the
   * card-array default otherwise.
   */
  bare?: boolean;
}

export function SectionGrid({ title, description, controls, children, hideHeader = false, titleAs: TitleTag = 'h2', bare = false }: SectionGridProps) {
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
      {bare ? children : <div className={theme.section.grid}>{children}</div>}
    </div>
  );
}
