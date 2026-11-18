import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';

export function MfaShell({
  heading,
  icon,
  tone,
  children,
}: {
  heading: React.ReactNode;
  icon: React.ReactNode;
  tone: 'normal' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div className="civic-page relative overflow-hidden min-h-[80vh] bg-background flex items-center justify-center px-4 pt-(--header-clearance) pb-16 text-foreground transition-colors duration-300">
      <VgpuCivicConstellation className="pointer-events-none opacity-25" />
      <div className="civic-panel relative z-10 w-full max-w-md p-10 text-center">
        <div className="flex flex-col items-center mb-8">
          <div
            className={`p-4 rounded-sm mb-4 ${tone === 'error' ? 'bg-rose-50 dark:bg-rose-950/50 text-accent-red' : 'bg-primary/10 text-primary dark:text-primary-on-dark'}`}
          >
            {icon}
          </div>
          <h1 className="mb-2 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">
            {heading}
          </h1>
          <div
            className={`h-1.5 w-16 ${tone === 'error' ? 'bg-accent-red' : 'bg-primary dark:bg-primary-bright'}`}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
