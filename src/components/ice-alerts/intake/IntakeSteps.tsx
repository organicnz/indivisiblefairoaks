import { CopyRegion } from '@/components/cms/CopyRegion';

type IntakeStep = {
  number: string;
  title: string;
  body: string;
};

type IntakeStepsProps = {
  copyRegionId: string;
  steps: readonly IntakeStep[];
};

export function IntakeSteps({ copyRegionId, steps }: IntakeStepsProps) {
  return (
    <section className="border border-border bg-surface-muted p-5">
      <CopyRegion id={copyRegionId}>
        <div>
          <p className="civic-section-index">What happens next</p>
          <ol className="mt-4 space-y-4">
            {steps.map((step) => (
              <li
                key={step.number}
                className="border-t border-border pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-accent">
                    {step.number}
                  </span>
                  <h3 className="font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </CopyRegion>
    </section>
  );
}
