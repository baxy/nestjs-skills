import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { authConfig } from './config/auth.config';
import { dbConfig } from './config/db.config';
import { validateEnv } from './config/validate-env';
import { OrderModule } from './order/order.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [authConfig, dbConfig], validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('db.host'),
        port: configService.getOrThrow<number>('db.port'),
        username: configService.getOrThrow<string>('db.username'),
        password: configService.getOrThrow<string>('db.password'),
        database: configService.getOrThrow<string>('db.name'),
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: configService.get<boolean>('db.synchronize', false),
      }),
    }),
    UserModule,
    OrderModule,
  ],
})
export class AppModule {}
