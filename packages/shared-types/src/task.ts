import { z } from 'zod';

import { taskStatusSchema } from './enums';
import { idSchema, timestampSchema } from './primitives';

/**
 * A task instance bound to a map node for a given run.
 *
 * The instance is what the user actually works on; the templates it came from
 * live in the engine's curated pools (M0: manual creation + templates).
 */
export const taskInstanceSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  successCriteria: z.string().min(1),
  durationMin: z.number().int().positive(),
  difficulty: z.number().nonnegative(),
  nodeId: idSchema,
  status: taskStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  startedAt: timestampSchema.optional(),
  completedAt: timestampSchema.optional(),
});

export type TaskInstance = z.infer<typeof taskInstanceSchema>;
