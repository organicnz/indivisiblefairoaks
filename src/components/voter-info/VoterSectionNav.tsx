const SECTIONS = [
  ['register', 'Register'],
  ['representatives', 'Representatives'],
  ['guides', 'Guides'],
  ['rights', 'Rights'],
  ['hotlines', 'Hotlines'],
] as const;

export function VoterSectionNav() {
  return (
    <nav aria-label="Voter information sections" className="border-b border-border bg-surface-card">
      <div className="mx-auto flex max-w-5xl gap-5 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        {SECTIONS.map(([href, label]) => (
          <a
            key={href}
            href={`#${href}`}
            className="shrink-0 border-b border-transparent py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
