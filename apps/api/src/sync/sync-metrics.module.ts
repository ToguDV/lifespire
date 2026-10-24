import { Global, Module } from '@nestjs/common';
import { SyncMetrics } from './sync-metrics';

/** Shared push counters, consumed by SyncModule and AdminModule. */
@Global()
@Module({ providers: [SyncMetrics], exports: [SyncMetrics] })
export class SyncMetricsModule {}
