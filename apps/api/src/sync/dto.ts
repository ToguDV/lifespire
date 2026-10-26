import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Matches, Max, Min } from 'class-validator';

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

/** Long-poll change feed. `wait` is mainly for tests and short-lived clients. */
export class WatchQuery {
  @IsOptional()
  @Matches(/^\d{1,20}$/)
  since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(250)
  @Max(30_000)
  wait?: number;
}
