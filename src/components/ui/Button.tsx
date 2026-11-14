import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  /** `signal` is the brass action; use it sparingly, never as body text. */
  variant?: 'primary' | 'secondary' | 'signal' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const variants = {
      primary: 'border border-primary bg-primary text-white hover:bg-primary-dark hover:border-primary-dark',
      secondary:
        'border border-secondary bg-secondary text-ink-on-dark hover:bg-foreground hover:border-foreground',
      signal:
        'border border-accent-gold bg-accent-gold text-ink-strong hover:brightness-95 hover:border-accent-gold',
      outline:
        'border border-foreground/30 bg-transparent text-foreground hover:border-primary hover:text-primary-ink',
      ghost: 'border border-transparent bg-transparent text-foreground hover:bg-surface-muted',
      danger: 'border border-accent bg-accent text-white hover:bg-accent-red hover:border-accent-red',
    };

    const sizes = {
      sm: 'min-h-10 px-4 text-[10px]',
      md: 'min-h-11 px-5 text-[11px]',
      lg: 'min-h-12 px-6 text-xs',
      icon: 'size-11 p-0',
    };

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-sm font-bold uppercase tracking-[0.12em] transition-colors duration-300 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
