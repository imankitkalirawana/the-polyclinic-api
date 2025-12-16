import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionCleanupService {
  constructor(
    @InjectRepository(Session, 'default')
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
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    console.log(`Cleaned up ${result.affected || 0} expired sessions`);
  }
}

