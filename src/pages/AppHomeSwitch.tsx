import { useAuth } from '../hooks/useAuth';
import { GuestHomePage } from './GuestHomePage';
import { HomePage } from './HomePage';

/**
 * `/home` route switch: authenticated users see the full app Home
 * (HomeLayoutA daily loop), guests see the action-first GuestHomePage.
 * Keeps HomePage unchanged for logged-in users while giving visitors a
 * focused "start here" start screen (Landing → Guest Home split).
 */
export function AppHomeSwitch() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <HomePage /> : <GuestHomePage />;
}