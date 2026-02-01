import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../../auth/entities/session.entity';

@Injectable()
export class PublicSessionCleanupService {
  private readonly logger = new Logger(PublicSessionCleanupService.name);

  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    await this.cleanupExpiredSessions();
  }

  async cleanupExpiredSessions(): Promise<void> {
    const result = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('expires_at < :now', { now: new Date() })
      .execute();

    this.logger.log(`Cleaned up ${result.affected || 0} expired sessions`);
  }
}
