import type { ReactNode } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  /** Use 'dark' for pages with a dark/secondary background */
  bg?: 'white' | 'dark' | 'none';
}

/**
 * Consistent page wrapper that clears the fixed navbar and iOS safe area.
 * and provides standard bottom padding. Use on every top-level page.
 *
 * The `bg` prop is a theme *intent*, not a palette: `white` means "a light
 * page" and `dark` means "a civic page", and both resolve through the tokens
 * so the reader's chosen palette decides what they actually paint. A civic
 * page in light mode is a light page; the same page in dark mode keeps the
 * dark surface it has always had.
 */
export function PageWrapper({ children, className = '', bg = 'white' }: PageWrapperProps) {
  const bgClass =
    bg === 'white'
      ? 'bg-background text-foreground'
      : bg === 'dark'
        ? 'bg-background text-foreground dark:bg-secondary dark:text-ink-on-dark'
        : '';

  return (
    <div className={`${bgClass} min-h-screen pt-(--header-clearance) pb-16 ${className}`}>
      {children}
    </div>
  );
}

/** Standard max-width content container */
export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}
