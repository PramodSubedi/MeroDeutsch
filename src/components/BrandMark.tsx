import { Link } from 'react-router-dom';
import { theme } from '../config/theme';

interface BrandMarkProps {
  /** Renders inside a <Link to="/"> when `linked` is true (used in the header). */
  linked?: boolean;
  className?: string;
}

/**
 * MeroDeutsch brand mark.
 * - "Mero" = solid red
 * - "Deutsch" = amber/gold gradient wordmark (solid fallback on dark/blue surfaces)
 */
export function BrandMark({ linked = false, className = '' }: BrandMarkProps) {
  const mark = (
    <span className={`inline-flex items-baseline ${className}`}>
      <span className="font-extrabold text-mero-red">{theme.brand.meroText}</span>
      <span className="ml-1 bg-gradient-to-r from-accent-gold to-mero-red bg-clip-text font-extrabold text-transparent">
        {theme.brand.deutschText}
      </span>
    </span>
  );

  if (!linked) return mark;

  return (
    <Link to="/" aria-label="MeroDeutsch – Home" className="transition duration-200 hover:opacity-90">
      {mark}
    </Link>
  );
}