import { useEffect, useState } from 'react';

import {
  dayKey as computeDayKey,
  deriveDailySeed,
  generateMap,
  type MapGenInput,
} from '@lifespire/engine';
import type { TaskInstance } from '@lifespire/shared-types';

import { db, type RunRecord } from '../../db/db';
import { ensureMeta, type DayMeta } from '../../db/meta';
import i18n from '../../i18n';
import { useRunStore } from '../run/runStore';
import { buildTasksForDay, type TemplateTranslate } from './taskTemplates';

/**
 * M0 rule profile: reduced map (only enemy/elite), level 1, no history
 * (ADR-016). Numbers here parameterize generation, they are not balance.
 */
const MAP_INPUT: MapGenInput = {
  profileId: 'm0',
  playerLevel: 1,
  successRate7d: 0,
  streakDays: 0,
};

export type DayRunStatus = 'loading' | 'ready' | 'error';

export interface DayRunData {
  run: RunRecord;
  meta: DayMeta;
}

export interface DayRunResult {
  status: DayRunStatus;
  data: DayRunData | null;
  error: string | null;
}

const translate: TemplateTranslate = (key, options) => i18n.t(key, options);

/**
 * Resolve the current day's run: compute `dayKey` + daily seed, reuse the cached
 * map when it exists (a day's map never changes) or generate and persist it
 * otherwise, then publish it to the run store.
 */
export function useDayRun(): DayRunResult {
  const [result, setResult] = useState<DayRunResult>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const meta = await ensureMeta();
        const key = computeDayKey(Date.now(), meta.tzOffsetMinutes, meta.dayCloseHour);

        const existing = await db.runs.get(key);
        let run: RunRecord;
        let tasks: TaskInstance[];

        if (existing) {
          run = existing;
          tasks = await db.tasks.where('id').startsWith(`${key}:`).toArray();
        } else {
          const seed = deriveDailySeed(meta.userSeedSalt, key, meta.engineVersion);
          const map = generateMap(seed, MAP_INPUT);
          tasks = buildTasksForDay(map, translate, key);
          const now = new Date().toISOString();
          run = {
            id: key,
            dayKey: key,
            seed,
            engineVersion: meta.engineVersion,
            map,
            progress: {},
            gold: 0,
            xp: 0,
            createdAt: now,
            updatedAt: now,
          };

          const created = run;
          await db.transaction('rw', db.runs, db.tasks, async () => {
            await db.runs.put(created);
            await db.tasks.bulkPut(tasks);
          });
        }

        if (cancelled) {
          return;
        }

        useRunStore.getState().setRun(run, tasks);
        setResult({ status: 'ready', data: { run, meta }, error: null });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setResult({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
