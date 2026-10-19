import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'ghost';
type ButtonSize = 'md' | 'sm';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-bg hover:opacity-90',
  ghost: 'bg-transparent text-muted border border-border hover:text-text',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'px-4 py-3 text-sm',
  sm: 'px-3 py-2 text-xs',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Minimal shadcn-flavoured button. Complete enough to be swapped for the
 * generated component later without changing call sites.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
