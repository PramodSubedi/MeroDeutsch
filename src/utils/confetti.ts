import confetti from 'canvas-confetti';

/**
 * Triggers a confetti burst using Mero Deutsch brand colors.
 * Fires confetti from a centered position with optimized visual effect.
 */
export function triggerConfetti(): void {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#2563EB', '#3B82F6', '#93C5FD'], // Tailwind blue shades
    startVelocity: 30,
    gravity: 0.8,
    scalar: 1,
    ticks: 200,
  });
}
