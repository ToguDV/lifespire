import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

/** PUT /v1/sync body. The document is validated structurally here; full game-rule validation lives in @lifespire/core on the client. */
export class PutSyncDto {
  @IsObject()
  document!: Record<string, unknown>;
}

export class RevisionQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
