import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const variants = {
      primary: 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/10',
      secondary: 'bg-secondary text-white hover:bg-secondary/90 shadow-lg shadow-secondary/10',
      outline:
        'border-2 border-secondary text-foreground hover:bg-secondary hover:text-white bg-transparent dark:border-border',
      ghost: 'hover:bg-surface-muted text-foreground bg-transparent',
      danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/10',
    };

    const sizes = {
      sm: 'px-4 py-2 text-[10px]',
      md: 'px-8 py-4 text-xs',
      lg: 'px-10 py-5 text-sm',
      icon: 'p-3',
    };

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-full font-black uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
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
