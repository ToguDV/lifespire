import { Module } from '@nestjs/common';
import { SyncMetricsModule } from './sync-metrics.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncWatchService } from './sync-watch.service';

@Module({
  imports: [SyncMetricsModule],
  controllers: [SyncController],
  providers: [SyncService, SyncWatchService],
})
export class SyncModule {}
