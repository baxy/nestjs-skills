import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from '../services/session.service';

@Injectable()
export class RefreshTokenPurgeJob {
  private readonly logger = new Logger(RefreshTokenPurgeJob.name);

  constructor(private readonly sessionService: SessionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async run(): Promise<void> {
    try {
      const deleted = await this.sessionService.deleteExpired();
      this.logger.log(`Deleted ${deleted} expired refresh tokens`);
    } catch (error) {
      this.logger.error('Refresh token purge failed', error instanceof Error ? error.stack : error);
    }
  }
}
