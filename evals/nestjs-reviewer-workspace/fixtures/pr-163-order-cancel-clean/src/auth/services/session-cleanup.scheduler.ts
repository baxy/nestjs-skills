import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

// Runs once per day across all replicas: every instance upserts the same scheduler id
@Injectable()
export class SessionCleanupScheduler implements OnModuleInit {
  constructor(@InjectQueue('session') private readonly sessionQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.sessionQueue.upsertJobScheduler('session-cleanup', { pattern: '0 0 * * *' }, { name: 'delete-expired' });
  }
}
