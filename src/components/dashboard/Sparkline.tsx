/**
 * src/components/dashboard/Sparkline.tsx
 *
 * A tiny, dependency-free trend line for use INSIDE a stat tile.
 *
 * WHY NOT RECHARTS FOR THIS
 * -------------------------
 * The three big charts on the Dashboard use Recharts, and so should anything
 * with axes, a tooltip or a legend. A sparkline has none of those: it is a
 * 72x24px shape that answers "which way is this going" at a glance.
 *
 * Recharts would put a `ResponsiveContainer` inside a flex tile, which is
 * where its known failure mode lives — the container reports width 0 on first
 * paint inside a grid/flex parent, and the line silently does not render. The
 * 20 lines below have no measurement step, no resize observer and no
 * dependency, so they cannot have that failure.
 *
 * IT IS DECORATIVE
 * ----------------
 * `aria-hidden` is unconditional. A 72x24 shape conveys a DIRECTION, and a
 * direction is meaningless announced as a number ("7, 3, 9, 12"). Every caller
 * pairs this with a real figure and a real label in text, which is what a
 * screen reader should hear. This component is the visual echo of a number
 * that is already on screen, never the only carrier of it.
 *
 * A FLAT LINE IS NOT A ZERO LINE
 * ------------------------------
 * All-zero input is common and meaningful (no activity for a week) and must
 * NOT be drawn as a dramatic crash to the baseline — that would invent a
 * decline that did not happen. When there is no signal, the path is omitted
 * entirely and a muted baseline is drawn instead.
 */
import { useId } from 'react';

export type SparkTone = 'accent' | 'success' | 'warning';

const STROKE: Record<SparkTone, string> = {
  accent: 'var(--color-accent-500)',
  success: 'var(--color-success-500)',
  warning: 'var(--color-warning-500)',
};

export function Sparkline({
  data,
  tone = 'accent',
  width = 72,
  height = 24,
  className,
}: {
  data: number[];
  tone?: SparkTone;
  width?: number;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();

  // Normalise to the box. `domain` spans the data's own min..max rather than
  // 0..max, because a sparkline shows SHAPE: with a 0-based domain a series
  // moving 8 -> 11 would render as two nearly flat lines and read as "nothing
  // is happening" when in fact it is growing steadily.
  const max = Math.max(...data, 0);
  const min = Math.min(...data);
  const span = max - min;
  const hasSignal = data.length > 1 && span > 0;

  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pointAt = (value: number, i: number) => {
    const y = hasSignal ? height - ((value - min) / span) * height : height / 2;
    return [i * stepX, y] as const;
  };

  const line = hasSignal
    ? data.map((v, i) => pointAt(v, i).map((n) => n.toFixed(2)).join(',')).join(' ')
    : '';
  const area = hasSignal
    ? `${line} ${width},${height} 0,${height}`
    : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {hasSignal ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STROKE[tone]} stopOpacity="0.22" />
              <stop offset="100%" stopColor={STROKE[tone]} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline
            points={line}
            fill="none"
            stroke={STROKE[tone]}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* The final point gets a filled dot so "you are HERE" is unambiguous
              and does not depend on the line ending at the right edge. */}
          {(() => {
            const [cx, cy] = pointAt(data[data.length - 1], data.length - 1);
            return <circle cx={cx} cy={cy} r="2" fill={STROKE[tone]} />;
          })()}
        </>
      ) : (
        // No signal: a dashed baseline, not a flat line pinned to the bottom.
        // "Nothing recorded" and "recorded and flat" are different states.
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-ink-300)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />
      )}
    </svg>
  );
}