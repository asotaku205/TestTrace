import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { DomainErrorFilter } from './domain-error.filter.js';
import { authConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new DomainErrorFilter());
  await app.listen(authConfig.port);
}

void bootstrap();
