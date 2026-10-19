import { useTranslation } from 'react-i18next';

import { computeRewards, type MapNode } from '@lifespire/engine';
import type { NodeVisitState, TaskInstance } from '@lifespire/shared-types';

import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { formatDecimal, formatInteger, formatList } from '@/lib/format';
import { expectedEvidence } from './taskTemplates';

export interface NodeDetailPanelProps {
  node: MapNode;
  task: TaskInstance;
  state: NodeVisitState;
  locale: string;
  onStart: (nodeId: string) => void;
  onChangeRoute: () => void;
}

/** Contextual panel for the selected node: task, metadata and reward estimate. */
export function NodeDetailPanel({
  node,
  task,
  state,
  locale,
  onStart,
  onChangeRoute,
}: NodeDetailPanelProps) {
  const { t } = useTranslation(['common', 'node']);

  const rewards = computeRewards(node.type, node.difficulty, 0);
  const evidence = formatList(
    expectedEvidence(node).map((kind) => t('node:evidenceExpected.' + kind)),
    locale,
  );

  return (
    <Panel className="w-full border-l lg:w-[280px]">
      <div>
        <div className="text-[10px] tracking-[0.14em] text-gold uppercase">
          {t('node:type.' + node.type)} · {t('node:row', { row: node.row + 1 })}
        </div>
        <h2 className="mt-1.5 font-display text-[19px] leading-snug font-semibold text-text">
          {task.title}
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{task.successCriteria}</p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Meta
          label={t('common:duration')}
          value={t('common:minutes', { count: task.durationMin })}
        />
        <Meta label={t('common:evidence')} value={evidence} />
        <Meta label={t('common:difficulty')} value={formatDecimal(node.difficulty, locale)} />
        <Meta label={t('node:stateLabel')} value={t('node:state.' + state)} />
      </dl>

      <div className="flex gap-2">
        <Reward
          label={t('common:gold')}
          value={t('node:reward.gold', { amount: formatInteger(rewards.gold, locale) })}
          accent="text-gold"
        />
        <Reward
          label={t('common:xp')}
          value={t('node:reward.xp', { amount: formatInteger(rewards.xp, locale) })}
          accent="text-xp"
        />
      </div>

      <div className="mt-auto flex items-center gap-2.5 pt-4">
        <Button className="flex-1" onClick={() => onStart(node.id)}>
          {t('common:start')}
        </Button>
        <Button variant="ghost" onClick={onChangeRoute}>
          {t('common:changeRoute')}
        </Button>
      </div>
    </Panel>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 px-2.5 py-2">
      <dt className="text-[9.5px] tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-text tabular-nums">{value}</dd>
    </div>
  );
}

function Reward({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex-1 rounded-sm border border-border bg-surface-2 px-2.5 py-2">
      <div className="text-[9.5px] tracking-[0.1em] text-muted uppercase">{label}</div>
      <div className={`mt-0.5 text-[15px] font-semibold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}
