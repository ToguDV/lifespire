import { useTranslation } from 'react-i18next';

import { SpireGlyph } from '@/components/SpireGlyph';
import { Chip } from '@/components/ui/chip';
import { formatHour, formatInteger } from '@/lib/format';

export interface TopBarProps {
  gold: number;
  xp: number;
  /** Day XP progress, 0-100. */
  xpPercent: number;
  dayKey: string;
  closeHour: number;
  /** 0-based frontier row. */
  row: number;
  totalRows: number;
  locale: string;
}

/**
 * Thin top bar: brand, gold, XP (with bar), today + close hour, row progress and
 * the "local-only" status chip. M0 shows no HP, streak or quests (roadmap §M0).
 */
export function TopBar({
  gold,
  xp,
  xpPercent,
  dayKey,
  closeHour,
  row,
  totalRows,
  locale,
}: TopBarProps) {
  const { t } = useTranslation(['common', 'home']);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
      <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-text">
        <SpireGlyph />
        {t('common:brand')}
      </span>

      <span className="h-5 w-px bg-border" aria-hidden="true" />

      <span className="flex items-center gap-2 text-[13px]">
        <span className="text-[10px] tracking-[0.1em] text-muted uppercase">
          {t('common:gold')}
        </span>
        <span className="font-semibold text-gold tabular-nums">{formatInteger(gold, locale)}</span>
      </span>

      <span className="flex items-center gap-2 text-[13px]">
        <span className="text-[10px] tracking-[0.1em] text-muted uppercase">{t('common:xp')}</span>
        <span className="font-semibold text-xp tabular-nums">{formatInteger(xp, locale)}</span>
        <span
          className="relative block h-[5px] w-[88px] overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={t('home:xpBarAria', { percent: Math.round(xpPercent) })}
          aria-valuenow={Math.round(xpPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="absolute inset-y-0 left-0 block bg-xp transition-[width] duration-base ease-out"
            style={{ width: `${xpPercent}%` }}
          />
        </span>
      </span>

      <span className="grow" />

      <Chip>{t('common:todayCloses', { dayKey, time: formatHour(closeHour, locale) })}</Chip>
      <Chip>{t('common:rowProgress', { row: row + 1, total: totalRows })}</Chip>
      <Chip>
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
        {t('common:status.localOnly')}
      </Chip>
    </header>
  );
}
