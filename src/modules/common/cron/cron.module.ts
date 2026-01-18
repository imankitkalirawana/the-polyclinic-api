import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Session } from '../auth/entities/session.entity';
import { Otp } from '../auth/entities/otp.entity';
import { SessionCleanupService } from './session-cleanup.service';
import { OtpCleanupService } from './otp-cleanup.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Tenant, Session, Otp], 'default'),
  ],
  providers: [SessionCleanupService, OtpCleanupService],
})
export class CronModule {}
