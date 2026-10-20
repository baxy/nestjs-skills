import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { TypeOrmModule } from '@nestjs/typeorm';
import KeyvRedis from '@keyv/redis';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { buildLoggerModule } from './logging/logger.module';
import { UserThrottlerGuard } from './shared/guards/user-throttler.guard';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { dbConfig } from './config/db.config';
import { redisConfig } from './config/redis.config';
import { validateEnv } from './config/validate-env';
import { OrderModule } from './order/order.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig, authConfig, dbConfig, redisConfig], validate: validateEnv }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: () => randomUUID() },
    }),
    buildLoggerModule(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'long', ttl: 60_000, limit: 300 },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [dbConfig.KEY],
      useFactory: (dbSettings: ConfigType<typeof dbConfig>) => ({
        type: 'postgres',
        host: dbSettings.host,
        port: dbSettings.port,
        username: dbSettings.username,
        password: dbSettings.password,
        database: dbSettings.name,
        schema: dbSettings.schema,
        logging: dbSettings.logging,
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [redisConfig.KEY],
      useFactory: (redisSettings: ConfigType<typeof redisConfig>) => ({
        stores: [new KeyvRedis(`redis://${redisSettings.host}:${redisSettings.port}`)],
        ttl: 60_000,
      }),
    }),
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redisSettings: ConfigType<typeof redisConfig>) => ({
        connection: { host: redisSettings.host, port: redisSettings.port },
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
      }),
    }),
    AuthModule,
    UserModule,
    OrderModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
