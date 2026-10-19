import { computeRewards } from '@lifespire/engine';
import type { TaskInstance, TaskStatus } from '@lifespire/shared-types';
import { create } from 'zustand';

import { db, type ResolvedNodeState, type RunRecord } from '../../db/db';

/** The two outcomes M0 supports. Failing is a `skipped` task, no penalty (GDD). */
export type RunOutcome = 'completed' | 'skipped';

interface RunStoreState {
  /** The cached run for the current day. */
  run: RunRecord | null;
  /** Task instances of the current day, keyed by `nodeId`. */
  tasks: Record<string, TaskInstance>;
  /** Load a run (and its tasks) into the session. */
  setRun: (run: RunRecord | null, tasks: TaskInstance[]) => void;
  /**
   * Resolve a node and persist the result. `completed` appends the engine's
   * reward to the run, `skipped` moves on with no consequence; in both cases the
   * successor nodes become available. Idempotent: a node already resolved is not
   * paid twice.
   */
  resolveNode: (runId: string, nodeId: string, outcome: RunOutcome) => Promise<void>;
}

export const useRunStore = create<RunStoreState>((set, get) => ({
  run: null,
  tasks: {},

  setRun: (run, tasks) =>
    set({
      run,
      tasks: Object.fromEntries(tasks.map((task) => [task.nodeId, task])),
    }),

  resolveNode: async (runId, nodeId, outcome) => {
    const session = get().run;
    const run = session && session.id === runId ? session : await db.runs.get(runId);
    if (!run) {
      return;
    }

    const node = run.map.nodes[nodeId];
    if (!node || run.progress[nodeId]) {
      return;
    }

    const resolved: ResolvedNodeState = outcome === 'completed' ? 'visited' : 'skipped';
    const updatedAt = new Date().toISOString();

    let { gold, xp } = run;
    if (outcome === 'completed') {
      const rewards = computeRewards(node.type, node.difficulty, 0);
      gold += rewards.gold;
      xp += rewards.xp;
    }

    const updated: RunRecord = {
      ...run,
      progress: { ...run.progress, [nodeId]: resolved },
      gold,
      xp,
      updatedAt,
    };

    const task = get().tasks[nodeId];
    const status: TaskStatus = outcome === 'completed' ? 'completed' : 'skipped';
    const updatedTask: TaskInstance | undefined = task
      ? {
          ...task,
          status,
          updatedAt,
          ...(status === 'completed' ? { completedAt: updatedAt } : {}),
        }
      : undefined;

    await db.transaction('rw', db.runs, db.tasks, async () => {
      await db.runs.put(updated);
      if (updatedTask) {
        await db.tasks.put(updatedTask);
      }
    });

    set((state) => ({
      run: updated,
      tasks: updatedTask ? { ...state.tasks, [nodeId]: updatedTask } : state.tasks,
    }));
  },
}));
