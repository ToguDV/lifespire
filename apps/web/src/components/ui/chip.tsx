import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

/** Small pill used in the top bar and legend (shadcn-flavoured). */
export function Chip({ className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1',
        'text-[11px] leading-none text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
