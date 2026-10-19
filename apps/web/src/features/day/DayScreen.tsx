import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { computeRewards, layoutMap } from '@lifespire/engine';

import { useRunStore } from '../run/runStore';
import { Legend } from './Legend';
import { MapCanvas } from './MapCanvas';
import { NodeDetailPanel } from './NodeDetailPanel';
import { TopBar } from './TopBar';
import { countDay, deriveFrontierRow, deriveNodeStates } from './nodeState';
import { useDayRun } from './useDayRun';

export interface DayScreenProps {
  /** Navigate to the task screen of a node. */
  onStartNode: (nodeId: string) => void;
}

/**
 * Home / day map (M0). It resolves the day's run (deterministic map cached in
 * IndexedDB), renders the interactive SVG map with the contextual detail panel
 * and keeps node selection as local UI state.
 */
export function DayScreen({ onStartNode }: DayScreenProps) {
  const { t } = useTranslation(['common', 'home']);
  const { status, data, error } = useDayRun();
  const sessionRun = useRunStore((state) => state.run);
  const tasks = useRunStore((state) => state.tasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const run = sessionRun ?? data?.run ?? null;

  const states = useMemo(
    () => (run ? deriveNodeStates(run.map, run.progress, selectedId) : {}),
    [run, selectedId],
  );
  const layout = useMemo(() => (run ? layoutMap(run.map) : null), [run]);
  const counts = useMemo(() => countDay(states), [states]);
  const frontierRow = useMemo(() => (run ? deriveFrontierRow(run.map, states) : 0), [run, states]);

  // XP bar: share of the day's total reward already earned. M0 has no level
  // curve yet (`xpToNext` is not part of the frozen engine surface).
  const xpPercent = useMemo(() => {
    if (!run) {
      return 0;
    }
    let total = 0;
    for (const node of Object.values(run.map.nodes)) {
      total += computeRewards(node.type, node.difficulty, 0).xp;
    }
    if (total <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((run.xp / total) * 100));
  }, [run]);

  if (status === 'loading') {
    return <Centered>{t('common:loading')}</Centered>;
  }
  if (status === 'error' || !run || !layout || !data) {
    return <Centered>{error ?? t('common:error')}</Centered>;
  }

  const selectedNode = selectedId ? run.map.nodes[selectedId] : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;
  const selectedTask = selectedId ? tasks[selectedId] : undefined;

  const handleSelect = (nodeId: string) => {
    const state = states[nodeId];
    if (!state || state === 'locked') {
      return;
    }
    setSelectedId(nodeId);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg font-ui text-text">
      <TopBar
        gold={run.gold}
        xp={run.xp}
        xpPercent={xpPercent}
        dayKey={run.dayKey}
        closeHour={data.meta.dayCloseHour}
        row={frontierRow}
        totalRows={run.map.rows.length}
        locale={data.meta.locale}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selectedNode ? (
            <p className="px-4 pt-3 text-xs text-muted">{t('common:selectNodeHint')}</p>
          ) : null}

          <div className="grid min-h-0 flex-1 place-items-center overflow-hidden p-3">
            <MapCanvas
              layout={layout}
              states={states}
              closingIds={run.map.closingIds}
              onSelect={handleSelect}
            />
          </div>

          <Legend counts={counts} />
        </div>

        {selectedNode && selectedTask && selectedState ? (
          <NodeDetailPanel
            node={selectedNode}
            task={selectedTask}
            state={selectedState}
            locale={data.meta.locale}
            onStart={onStartNode}
            onChangeRoute={() => setSelectedId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-8 text-sm text-muted">
      {children}
    </div>
  );
}
