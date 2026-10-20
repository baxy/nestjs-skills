import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { SessionProcessor } from './processors/session.processor';
import { SessionCleanupScheduler } from './services/session-cleanup.scheduler';
import { SessionService } from './services/session.service';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken]), BullModule.registerQueue({ name: 'session' })],
  providers: [SessionService, SessionCleanupScheduler, SessionProcessor],
})
export class AuthModule {}
