import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type PanelProps = HTMLAttributes<HTMLDivElement>;

/** Surface container for the contextual detail panel (shadcn-flavoured). */
export function Panel({ className, ...props }: PanelProps) {
  return (
    <div className={cn('flex flex-col gap-4 border-border bg-surface p-4', className)} {...props} />
  );
}
