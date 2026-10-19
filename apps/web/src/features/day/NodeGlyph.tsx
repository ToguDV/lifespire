import type { NodeType } from '@lifespire/engine';

import { cn } from '@/lib/cn';

/**
 * One glyph per node type. The **shape** carries the type — enemy chevrons,
 * elite diamond, rest droplet, shop coin, event sparkle, boss hexagon — so the
 * map stays readable without relying on color (accessibility). Color comes from
 * the parent group through `currentColor` and maps to a token.
 */
export function NodeGlyph({ type, className }: { type: NodeType; className?: string }) {
  const common = cn('stroke-current', className);

  switch (type) {
    case 'enemy':
      return (
        <path
          d="M-7-5l6.5 7L-7 9M1-5l6.5 7L1 9"
          className={cn('fill-none', common)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'elite':
      return (
        <g className={common}>
          <path d="M0-9 9 0 0 9-9 0Z" className="fill-none" strokeWidth={1.6} />
          <circle r={2.2} className="fill-current stroke-none" />
        </g>
      );
    case 'rest':
      return (
        <path
          d="M0 9c3.6-2.2 5.8-5 5.8-8C5.8-2.2 3.2-4.8 0-7.2-3.2-4.8-5.8-2.2-5.8 1c0 3 2.2 5.8 5.8 8Z"
          className={cn('fill-none', common)}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'shop':
      return (
        <g className={common}>
          <circle r={6} className="fill-none" strokeWidth={1.5} />
          <path d="M-4 9h8" className="fill-none" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
    case 'event':
      return (
        <path
          d="M0-9 2.4-2.4 9 0 2.4 2.4 0 9-2.4 2.4-9 0-2.4-2.4Z"
          className={cn('fill-none', common)}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'boss':
      return (
        <g className={common}>
          <path d="M0-9 8-4.5 8 4.5 0 9-8 4.5-8-4.5Z" className="fill-none" strokeWidth={1.6} />
          <circle r={1.8} className="fill-current stroke-none" />
        </g>
      );
    default:
      return null;
  }
}
