import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SessionService } from '../services/session.service';

@Processor('session')
export class SessionProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionProcessor.name);

  constructor(private readonly sessionService: SessionService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'delete-expired': {
        const deleted = await this.sessionService.deleteExpired();
        this.logger.log(`Deleted ${deleted} expired refresh tokens`);
        return;
      }
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.name} ${job.id} failed (attempt ${job.attemptsMade})`, error.stack);
  }
}
