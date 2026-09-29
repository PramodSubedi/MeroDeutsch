/**
 * src/lib/adminRole.ts
 *
 * THE shared admin-authorization reader — used by BOTH admin surfaces.
 *
 * WHY A SHARED MODULE INSTEAD OF TOUCHING `useAuth`
 * -------------------------------------------------
 * The learner app's `src/hooks/useAuth.tsx` maps a Supabase `User` to the
 * narrow `AuthUser` shape (userId / username / avatarUrl) and never touches the
 * `profiles` table. Adding a `role` fetch there would put an extra round trip
 * and an admin concern on the critical path of every learner on every page.
 *
 * The admin control center lives at admin.merodeutsch.pramods.com.np, a
 * different origin with its own session. It needs a role lookup; the learner app
 * does not. So the lookup lives here, is called only by admin code, and
 * `useAuth.tsx` stays byte-for-byte unchanged (.clinerules C15/C16).
 *
 * AUTHORIZATION IS DEFENCE IN DEPTH, NOT A CLIENT CHECK
 * ----------------------------------------------------
 * `isAdminProfile()` is a UI affordance — it decides what to RENDER. It is not
 * the security boundary. The boundary is the `role` column's guard trigger
 * (a user cannot self-promote) plus the `EXISTS (... role = 'admin')` RLS
 * policies on every user-scoped table. A tampered client can render whatever it
 * likes and still read nothing: every query is filtered by the database.
 */

import { supabase } from './supabase';

/** The two roles the `profiles_role_check` constraint permits. */
export type AdminRole = 'user' | 'admin';

/**
 * The `profiles` row shape this app reads.
 *
 * NOTE ON `email`: there is deliberately no email here. Emails live in
 * `auth.users`, which the browser anon key cannot SELECT. The admin UI shows
 * `username` and the user id instead; surfacing real emails would require a
 * service-role Edge Function, which is out of scope for the client-only build.
 */
export interface AdminProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  language_preference: string | null;
  plan: string | null;
  role: AdminRole;
  /** Non-null when an admin has suspended the account. */
  banned_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Columns the admin UI is allowed to know about, in one place. */
export const ADMIN_PROFILE_COLUMNS =
  'id, username, full_name, avatar_url, language_preference, plan, role, banned_at, created_at, updated_at';

export interface AdminIdentity {
  profile: AdminProfile | null;
  role: AdminRole;
  isAdmin: boolean;
  isBanned: boolean;
  /** Populated when the lookup itself failed (network / missing role column). */
  error: string | null;
}

/**
 * Is this a live admin?
 *
 * ── WHY THE SUSPENDED CASE IS INSIDE THIS, NOT BESIDE IT ────────────────────
 * This used to read only `profile?.role === 'admin'` while accepting
 * `banned_at` in its parameter type — so `AdminIdentity.isAdmin` came back
 * `true` for a SUSPENDED admin. The database's own predicate does not:
 * `is_active_admin()` requires `role = 'admin' AND banned_at IS NULL`, and the
 * Edge Function re-reads privilege through it. The client was therefore
 * strictly more permissive than the server on the one question that decides
 * whether a banned operator should be inside the control centre at all.
 *
 * Nothing exploited it: `useAdminAuth` happened to check `isBanned` first, so
 * the single existing consumer was correct by ORDERING rather than by the
 * predicate it was reading. That is a coincidence, not a guarantee, and the next
 * consumer of `AdminIdentity.isAdmin` would have inherited a hole.
 *
 * The mirror is now the rule: if the client and the SQL disagree about who is an
 * admin, the client is wrong.
 */
export function isAdminProfile(profile: Pick<AdminProfile, 'role' | 'banned_at'> | null): boolean {
  if (!profile) return false;
  return profile.role === 'admin' && !isSuspended(profile);
}

/** A banned admin is locked out too — suspension is not bypassed by privilege. */
export function isSuspended(profile: Pick<AdminProfile, 'banned_at'> | null): boolean {
  return Boolean(profile?.banned_at);
}

/**
 * Read one profile's admin standing.
 *
 * Resolves to a neutral, non-admin identity on any failure rather than throwing:
 * a lookup error must fail CLOSED (render the sign-in / not-authorized screen),
 * never open. The `error` field carries the reason for the UI to show.
 */
export async function fetchAdminIdentity(userId: string): Promise<AdminIdentity> {
  const { data, error } = await supabase
    .from('profiles')
    .select(ADMIN_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      profile: null,
      role: 'user',
      isAdmin: false,
      isBanned: false,
      error: error.message,
    };
  }

  // A signed-in auth user with no profile row is not an admin. The row is
  // normally created by a trigger on signup; its absence means we cannot
  // establish standing, so we decline.
  if (!data) {
    return {
      profile: null,
      role: 'user',
      isAdmin: false,
      isBanned: false,
      error: 'No profile row found for this account.',
    };
  }

  const profile = data as AdminProfile;
  return {
    profile,
    role: profile.role,
    isAdmin: isAdminProfile(profile),
    isBanned: isSuspended(profile),
    error: null,
  };
}
