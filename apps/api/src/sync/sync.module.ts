import { Module } from '@nestjs/common';
import { SyncMetricsModule } from './sync-metrics.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({ imports: [SyncMetricsModule], controllers: [SyncController], providers: [SyncService] })
export class SyncModule {}
