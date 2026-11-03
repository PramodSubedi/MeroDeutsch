import type { ReactNode } from 'react';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 max-w-3xl">
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1 className="admin-page-title mt-2">{title}</h1>
        <p className="admin-page-copy">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
