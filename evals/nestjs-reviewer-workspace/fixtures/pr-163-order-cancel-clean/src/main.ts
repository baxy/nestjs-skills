import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

process.on('uncaughtException', (error) => {
  console.error('[orders-api-alert] uncaught exception:', error); // Intentional: must survive logger failure
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[orders-api-alert] unhandled rejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);
  app.use(helmet());
  app.enableCors({
    origin: configService.getOrThrow<string[]>('app.corsOrigins'),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(configService.getOrThrow<number>('app.port'), configService.getOrThrow<string>('app.host'));
}
bootstrap();
