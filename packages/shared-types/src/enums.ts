import { z } from 'zod';

/**
 * Domain enums shared by the client and (from M2) the API.
 *
 * These mirror the engine's value sets but are declared here as zod schemas so
 * DTOs can be validated without importing `@lifespire/engine` (the dependency
 * rule forbids `shared-types` -> `engine`).
 */

/** Map node kind. Mirrors `NodeType` in `@lifespire/engine`. */
export const nodeTypeSchema = z.enum(['enemy', 'elite', 'event', 'shop', 'rest', 'boss']);
export type NodeType = z.infer<typeof nodeTypeSchema>;

/** Lifecycle of a task instance. `failed` is reserved: M0 fails as `skipped`. */
export const taskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** How a user evidences a task. Photo, note or link only (no video). */
export const evidenceKindSchema = z.enum(['photo', 'note', 'link']);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

/** Per-node progress state derived from the local run. */
export const nodeVisitStateSchema = z.enum([
  'locked',
  'available',
  'current',
  'visited',
  'skipped',
]);
export type NodeVisitState = z.infer<typeof nodeVisitStateSchema>;
