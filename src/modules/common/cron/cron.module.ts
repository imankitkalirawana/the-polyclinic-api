import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Session } from '../../auth/entities/session.entity';
import { PublicSessionCleanupService } from './public/public-session-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([Session])],
  providers: [PublicSessionCleanupService],
})
export class CronModule {}
