import type { ReactNode } from 'react';

export function AdminNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 border border-accent/35 bg-accent/5 p-4 text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
