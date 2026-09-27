/**
 * src/components/chat/MeroAvatar.tsx — the owl.
 *
 * Pure inline SVG + CSS transitions. No image assets, no animation library:
 * the whole mascot is ~40 lines of path data, which keeps it themeable in light
 * and dark without shipping two sets of artwork.
 *
 * THE PUPIL TRACKING IS SELF-CONTAINED ON PURPOSE
 * -----------------------------------------------
 * The avatar listens for pointer movement itself rather than receiving a
 * position prop. Threading pointer coordinates from the sidebar would couple
 * two components that have no real relationship, and the avatar is also used
 * in Settings, where no sidebar exists to feed it.
 */

import { useEffect, useRef, useState } from 'react';
import type { MeroMood } from '../../types/chatbot';

export interface MeroAvatarProps {
  mood: MeroMood;
  /** Rendered px size. The viewBox scales, so the drawing never distorts. */
  size?: number;
  className?: string;
}

/** How far the pupils may travel from centre, in viewBox units. */
const PUPIL_TRAVEL = 1.6;

export function MeroAvatar({ mood, size = 40, className = '' }: MeroAvatarProps) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const node = svgRef.current;
      if (!node) return;
      if (frame.current !== null) return; // already scheduled this tick
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // Normalise to -1..1 across the viewport, clamped near the avatar.
        setLook({
          x: Math.max(-1, Math.min(1, (event.clientX - cx) / 260)),
          y: Math.max(-1, Math.min(1, (event.clientY - cy) / 260)),
        });
      });
    };
    const onLeave = () => setLook({ x: 0, y: 0 });

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const dx = look.x * PUPIL_TRAVEL;
  const dy = look.y * PUPIL_TRAVEL;
  const blinking = mood === 'sleeping';
  const winking = mood === 'teasing';

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={`Mero the owl — ${mood}`}
    >
      {/* ear tufts */}
      <path d="M12 18 L18 8 L26 15 Z" fill="var(--owl-tuft, #d97706)" />
      <path d="M52 18 L46 8 L38 15 Z" fill="var(--owl-tuft, #d97706)" />

      {/* body */}
      <ellipse cx="32" cy="35" rx="24" ry="23" fill="var(--owl-body, #f59e0b)" />
      {/* belly */}
      <ellipse cx="32" cy="42" rx="15" ry="14" fill="var(--owl-belly, #fef3c7)" />

      {/* eye discs */}
      <circle cx="22" cy="31" r="10" fill="#ffffff" />
      <circle cx="42" cy="31" r="10" fill="#ffffff" />

      {/* eyes — shape varies by mood */}
      {blinking ? (
        <>
          <path d="M16 32 Q22 36 28 32" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M36 32 Q42 36 48 32" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'happy' || mood === 'proud' ? (
        <>
          <path d="M16 33 Q22 26 28 33" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M36 33 Q42 26 48 33" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={22 + dx} cy={31 + dy} r="4" fill="#1f2937" className="transition-all duration-150" />
          {winking ? (
            <path d="M36 32 Q42 35 48 32" stroke="#1f2937" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : (
            <circle cx={42 + dx} cy={31 + dy} r="4" fill="#1f2937" className="transition-all duration-150" />
          )}
        </>
      )}

      {/* brow — only when concerned or thinking */}
      {(mood === 'concerned' || mood === 'thinking') && (
        <>
          <path d="M15 20 L27 24" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M49 20 L37 24" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {/* beak */}
      {mood === 'concerned' || mood === 'sleeping' ? (
        <path d="M29 41 L32 46 L35 41" stroke="#b45309" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M32 38 L36 45 L32 43 L28 45 Z" fill="#b45309" />
      )}

      {/* "zzz" while asleep */}
      {blinking && (
        <text x="48" y="16" fontSize="9" fontWeight="700" fill="#b45309">
          z
        </text>
      )}
    </svg>
  );
}
