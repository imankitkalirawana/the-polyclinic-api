import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Otp } from '../auth/entities/otp.entity';

@Injectable()
export class OtpCleanupService {
  private readonly logger = new Logger(OtpCleanupService.name);

  constructor(
    @InjectRepository(Otp)
    private otpRepository: Repository<Otp>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    this.logger.log('Running expired OTPs cleanup...');

    try {
      const result = await this.otpRepository.delete({
        expiresAt: LessThan(new Date()),
      });

      this.logger.log(`Deleted ${result.affected || 0} expired OTPs`);
    } catch (error) {
      this.logger.error('Error cleaning up expired OTPs:', error);
    }
  }
}
