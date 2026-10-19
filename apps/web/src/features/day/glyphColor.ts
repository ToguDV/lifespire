import type { NodeType } from '@lifespire/engine';

/**
 * Glyph stroke color per node type, applied to the parent group through
 * `currentColor`. Kept out of the component file so Fast Refresh stays happy.
 */
export const GLYPH_COLOR: Record<NodeType, string> = {
  enemy: 'text-muted',
  elite: 'text-event',
  event: 'text-event',
  shop: 'text-gold',
  rest: 'text-rest',
  boss: 'text-xp',
};
