import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

/** PUT /v1/sync body. Shape-checked here; game rules are enforced by the server via @lifespire/core. */
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
