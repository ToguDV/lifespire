import { Module } from '@nestjs/common';
import { SyncMetrics } from './sync-metrics';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({ controllers: [SyncController], providers: [SyncService, SyncMetrics], exports: [SyncMetrics] })
export class SyncModule {}
