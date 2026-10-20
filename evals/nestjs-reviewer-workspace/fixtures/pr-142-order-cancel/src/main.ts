import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

process.on('uncaughtException', (error) => {
  console.error('[orders-api-alert] uncaught exception:', error); // Must survive a logger failure
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[orders-api-alert] unhandled rejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  await app.listen(configService.getOrThrow<number>('app.port'), configService.getOrThrow<string>('app.host'));
}
bootstrap();
