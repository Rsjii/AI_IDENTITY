import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-tertiary p-6 text-center animate-fade-in">
      <div className="text-lg font-semibold text-text-primary">{title}</div>
      {description ? <div className="mt-2 text-sm text-text-secondary">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}


