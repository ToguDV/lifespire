import { cn } from '@/lib/cn';

/** The LifeSpire spire mark, used as the brand glyph. */
export function SpireGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 30" width="15" height="22" aria-hidden="true" className={cn(className)}>
      <path d="M10 1 18 14h-4.6l4 7H2.6l4-7H2Z" className="fill-gold" opacity={0.9} />
      <rect x="8.6" y="21" width="2.8" height="8" className="fill-gold" opacity={0.55} />
    </svg>
  );
}
