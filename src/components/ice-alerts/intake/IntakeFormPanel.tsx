import type { ReactNode } from 'react';

type IntakeFormPanelProps = {
  eyebrow: string;
  titleId: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function IntakeFormPanel({
  eyebrow,
  titleId,
  title,
  description,
  children,
}: IntakeFormPanelProps) {
  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <div className="border border-border bg-surface-card p-5 sm:p-7">
        <p className="civic-section-index">{eyebrow}</p>
        <h2
          id={titleId}
          className="mt-1.5 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
        >
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 border-t border-border pt-5">{children}</div>
      </div>
    </section>
  );
}
