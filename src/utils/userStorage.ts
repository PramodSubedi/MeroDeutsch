/**
 * Build a per-user storage key so authenticated users never share data.
 * Guests use a fixed "guest" suffix so they never see another user's stats.
 */
export function scopedKey(base: string, userId: string | null): string {
  return userId ? `${base}:${userId}` : `${base}:guest`;
}