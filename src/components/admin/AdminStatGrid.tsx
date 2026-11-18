import type { ReactNode } from 'react';

type AdminStat = {
  label: string;
  value: ReactNode;
};

export function AdminStatGrid({ stats }: { stats: AdminStat[] }) {
  return (
    <div className="mb-5 grid gap-px border border-border bg-border sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface-card p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {stat.label}
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
