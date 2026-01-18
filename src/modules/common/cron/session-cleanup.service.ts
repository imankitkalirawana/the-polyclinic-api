import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Session } from '../auth/entities/session.entity';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions() {
    this.logger.log('Running expired sessions cleanup...');

    try {
      const result = await this.sessionRepository.delete({
        expiresAt: LessThan(new Date()),
      });

      this.logger.log(`Deleted ${result.affected || 0} expired sessions`);
    } catch (error) {
      this.logger.error('Error cleaning up expired sessions:', error);
    }
  }
}
