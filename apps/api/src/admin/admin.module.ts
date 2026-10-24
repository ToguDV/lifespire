import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [SyncModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
