import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { configureApp } from '@/configure-app';

export async function createTestApp(moduleRef: TestingModule): Promise<INestApplication> {
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
