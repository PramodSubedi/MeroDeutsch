import { type ReactNode } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  return <div className="space-y-6">{children}</div>;
}