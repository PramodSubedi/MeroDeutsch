/**
 * src/config/appInfo.ts
 *
 * Single source of truth for app-level metadata that used to be hardcoded in
 * several places (Footer shipped a stale "Production v1.2.0" literal while
 * package.json was at 0.2.0).
 *
 * Keeping this in a tiny module (rather than importing package.json) avoids
 * pulling the whole manifest into the client bundle and keeps tsconfig's
 * `include: ["src"]` root clean.
 *
 * ⚠️ Keep APP_VERSION in sync with `package.json` → `version`.
 */
export const APP_VERSION = '0.2.0';

/** Human-facing product label used in shell chrome. */
export const APP_NAME = 'MeroDeutsch';

/** Legal copy revision shown on /privacy and /terms. */
export const LEGAL_LAST_UPDATED = '2026';
