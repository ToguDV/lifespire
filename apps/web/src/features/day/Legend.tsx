import { useTranslation } from 'react-i18next';

import type { NodeType } from '@lifespire/engine';

import { cn } from '@/lib/cn';
import { GLYPH_COLOR } from './glyphColor';
import { NodeGlyph } from './NodeGlyph';
import type { DayCounts } from './nodeState';

const LEGEND_TYPES: NodeType[] = ['enemy', 'elite', 'rest', 'shop', 'event', 'boss'];
const M0_TYPES = new Set<NodeType>(['enemy', 'elite']);

export interface LegendProps {
  counts: DayCounts;
}

/** One discreet line: every glyph plus the day's summary. */
export function Legend({ counts }: LegendProps) {
  const { t } = useTranslation(['common', 'home', 'node']);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[10.5px] text-muted">
      {LEGEND_TYPES.map((type) => {
        const planned = !M0_TYPES.has(type);
        return (
          <span key={type} className={cn('flex items-center gap-1.5', planned && 'opacity-60')}>
            <svg
              viewBox="-12 -12 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              className={cn(
                'shrink-0 rounded-full border border-border bg-surface-2',
                GLYPH_COLOR[type],
              )}
            >
              <NodeGlyph type={type} />
            </svg>
            {t('node:type.' + type)}
            {planned ? t('common:legendLater') : null}
          </span>
        );
      })}
      <span className="ml-auto">
        {t('home:legendSummary', {
          resolved: counts.resolved,
          skipped: counts.skipped,
          remaining: counts.remaining,
        })}
      </span>
    </div>
  );
}
