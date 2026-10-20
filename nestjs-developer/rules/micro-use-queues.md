---
title: Run Background Jobs on BullMQ Queues
impact: MEDIUM-HIGH
impactDescription: Slow or must-succeed work is retried, visible and off the request path
tags: microservices, queues, bullmq, background-jobs, scheduling
---

## Run Background Jobs on BullMQ Queues

Use `@nestjs/bullmq` for work that is slow (report generation, file processing) or must eventually succeed (emails, webhooks to other systems). The request records the work, enqueues a job and returns (`202 Accepted` with the record's id and status, see `api-controller-conventions`); a worker processes it with retries.

- The Redis connection comes from config (`redis.*`, see `devops-use-config-module`) through `BullModule.forRootAsync`.
- Each feature module registers the queues it owns (`BullModule.registerQueue({ name: 'report' })`) and keeps its workers in `processors/` (see `arch-feature-modules`). Queue names are singular, kebab-case resource or concern names.
- A worker extends `WorkerHost` and implements `process(job)`, branching on `job.name`. It throws to fail a job, so BullMQ retries it with backoff; it never swallows an error.
- Jobs carry ids, not entities: the worker loads current data when it runs.
- **Scheduling:** a recurring job that must run once across all instances is a BullMQ job scheduler. `@Cron` from `@nestjs/schedule` runs on every instance, so use it only for per-instance housekeeping (see `error-handle-async-errors`).
- A queue dashboard (Bull Board) uses the adapter for your HTTP platform and sits behind authentication: global guards do not cover routes it mounts itself.

**Incorrect (slow work in the request, no retries, timers):**

```typescript
@Controller('reports')
export class ReportController {
  @Post()
  async create(@AuthUser() authUser: JwtUser, @Body() dto: CreateReportDto): Promise<Report> {
    const report = await this.reportService.render(authUser, dto); // Minutes inside a request: the client times out
    await this.mailService.send(authUser.email, report);            // A failure here loses the report
    return report;
  }
}

setInterval(() => this.sessionService.deleteExpired(), 60_000); // Runs on every instance, errors unhandled
```

**Correct (enqueue in the request, process in a worker, schedule once):**

```typescript
// app.module.ts
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redisSettings: ConfigType<typeof redisConfig>) => ({
        connection: {
          host: redisSettings.host,
          port: redisSettings.port,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: 1_000, // Keep the last 1000 for inspection
          removeOnFail: 5_000,
        },
      }),
    }),
  ],
})
export class AppModule {}

// report/report.module.ts
@Module({
  imports: [BullModule.registerQueue({ name: 'report' })],
  controllers: [ReportController],
  providers: [ReportService, ReportProcessor],
})
export class ReportModule {}

// report/services/report.service.ts - producer
@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectQueue('report') private readonly reportQueue: Queue,
  ) {}

  async create(authUser: JwtUser, dto: CreateReportDto): Promise<Report> {
    const report = await this.reportRepository.save(
      this.reportRepository.create({ ...dto, userId: authUser.id, status: ReportStatus.Queued }),
    );
    await this.reportQueue.add('render', { reportId: report.id });
    return report; // The controller answers 202 with the report's id and status
  }
}

// report/processors/report.processor.ts - worker
@Processor('report')
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly reportRenderer: ReportRenderer) {
    super();
  }

  async process(job: Job<{ reportId: string }>): Promise<void> {
    switch (job.name) {
      case 'render':
        await this.reportRenderer.render(job.data.reportId); // Throws to fail the job and trigger a retry
        return;
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.name} ${job.id} failed (attempt ${job.attemptsMade})`, error.stack);
  }
}

// auth/services/session-cleanup.scheduler.ts - runs once per day across all instances
@Injectable()
export class SessionCleanupScheduler implements OnModuleInit {
  constructor(@InjectQueue('session') private readonly sessionQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Idempotent: every instance upserts the same scheduler id
    await this.sessionQueue.upsertJobScheduler('session-cleanup', { pattern: '0 0 * * *' }, { name: 'delete-expired' });
  }
}
```

Reference: [NestJS Queues (BullMQ)](https://docs.nestjs.com/techniques/queues) · [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers)
