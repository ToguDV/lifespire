import Dexie, { type Table } from 'dexie';

import type { MapData } from '@lifespire/engine';
import type { NodeVisitState, TaskInstance } from '@lifespire/shared-types';

/** Key/value store for machine-level metadata (`userSeedSalt`, timezone, ...). */
export interface MetaRecord {
  key: string;
  value: string;
}

/** A node the player has already dealt with. */
export type ResolvedNodeState = Extract<NodeVisitState, 'visited' | 'skipped'>;

/** The cached run of a single day. The map never changes once created. */
export interface RunRecord {
  id: string;
  dayKey: string;
  seed: string;
  engineVersion: string;
  map: MapData;
  progress: Record<string, ResolvedNodeState>;
  gold: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
}

/** A locally stored evidence blob (M0: stays on the device). */
export interface EvidenceBlobRecord {
  id: string;
  taskId: string;
  blob: Blob;
  checksum: string;
  createdAt: string;
}

/**
 * IndexedDB database (ADR-006/ADR-015). There is no network in M0: this is the
 * only persistence layer. `tasks` and `evidenceBlobs` are already here for the
 * task/timer screen that lands next.
 */
export class LifeSpireDb extends Dexie {
  meta!: Table<MetaRecord, string>;
  runs!: Table<RunRecord, string>;
  tasks!: Table<TaskInstance, string>;
  evidenceBlobs!: Table<EvidenceBlobRecord, string>;

  constructor() {
    super('lifespire');
    this.version(1).stores({
      meta: 'key',
      runs: 'id, dayKey',
      tasks: 'id, nodeId, status',
      evidenceBlobs: 'id, taskId',
    });
  }
}

export const db = new LifeSpireDb();
