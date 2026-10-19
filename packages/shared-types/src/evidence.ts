import { z } from 'zod';

import { evidenceKindSchema } from './enums';
import { idSchema, timestampSchema } from './primitives';

/**
 * Evidence attached to a task.
 *
 * In M0 nothing leaves the device: the blob (if any) lives in IndexedDB and
 * `checksum` is computed locally. From M2 the same shape travels through
 * `/v1/evidence` with a signed-URL upload.
 */
export const evidenceSchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    kind: evidenceKindSchema,
    localBlobId: idSchema.optional(),
    note: z.string().min(1).optional(),
    url: z.url().optional(),
    checksum: z.string().min(1),
    createdAt: timestampSchema,
  })
  .refine((value) => value.kind !== 'photo' || value.localBlobId !== undefined, {
    message: 'photo evidence requires a localBlobId',
    path: ['localBlobId'],
  })
  .refine((value) => value.kind !== 'note' || value.note !== undefined, {
    message: 'note evidence requires a note',
    path: ['note'],
  })
  .refine((value) => value.kind !== 'link' || value.url !== undefined, {
    message: 'link evidence requires a url',
    path: ['url'],
  });

export type Evidence = z.infer<typeof evidenceSchema>;
