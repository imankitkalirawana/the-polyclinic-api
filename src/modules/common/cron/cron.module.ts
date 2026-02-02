import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Session } from '../../auth/entities/session.entity';
import { MasterKeyModule } from '@/common/utilities/master-key/masterkey.module';
import { PublicSessionCleanupService } from './public/public-session-cleanup.service';
import { MasterKeyRotateCronService } from './master-key-rotate-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Session]),
    MasterKeyModule,
  ],
  providers: [PublicSessionCleanupService, MasterKeyRotateCronService],
})
export class CronModule {}
