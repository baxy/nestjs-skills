import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { CatalogService } from './services/catalog.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          new KeyvRedis(`redis://${configService.getOrThrow<string>('redis.host')}:${configService.getOrThrow<number>('redis.port')}`),
        ],
        ttl: 60_000,
      }),
    }),
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
