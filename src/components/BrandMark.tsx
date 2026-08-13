import { Link } from 'react-router-dom';
import { theme } from '../config/theme';

interface BrandMarkProps {
  /** Renders inside a <Link to="/"> when `linked` is true (used in the header). */
  linked?: boolean;
  /** Light variant for dark/colored surfaces (e.g. the blue header bar). */
  light?: boolean;
  className?: string;
}

/**
 * MeroDeutsch brand mark.
 * - "Mero" = solid red (white when `light`)
 * - "Deutsch" = amber/gold gradient wordmark (light amber when `light`)
 */
export function BrandMark({ linked = false, light = false, className = '' }: BrandMarkProps) {
  const mark = (
    <span className={`inline-flex items-baseline ${className}`}>
      <span className={`font-extrabold ${light ? 'text-white' : 'text-mero-red'}`}>
        {theme.brand.meroText}
      </span>
      <span
        className={`ml-1 font-extrabold ${
          light
            ? 'bg-gradient-to-r from-amber-300 to-amber-100 bg-clip-text text-transparent'
            : 'bg-gradient-to-r from-accent-gold to-mero-red bg-clip-text text-transparent'
        }`}
      >
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