import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './useAuth';

const { onAuthStateChange, unsubscribe, migrate } = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  migrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange } } }));
vi.mock('../lib/db', () => ({ migrateLocalStorageToDexie: migrate }));

function SessionStatus() {
  const { isLoading, user } = useAuth();
  return <div>{isLoading ? 'Restoring session' : user?.userId ?? 'Guest'}</div>;
}

it('waits for session restoration before starting the account migration', () => {
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  const view = render(<AuthProvider><SessionStatus /></AuthProvider>);
  expect(screen.getByText('Restoring session')).toBeVisible();
  expect(migrate).not.toHaveBeenCalled();

  const notify = onAuthStateChange.mock.calls[0][0];
  act(() => notify('INITIAL_SESSION', { user: { id: 'learner' } } as Session));
  expect(screen.getByText('learner')).toBeVisible();
  expect(migrate).toHaveBeenCalledWith('learner', { cleanup: true });

  act(() => notify('SIGNED_OUT', null));
  expect(screen.getByText('Guest')).toBeVisible();
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
