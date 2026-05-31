import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '100mb' });
  app.useBodyParser('urlencoded', { limit: '100mb', extended: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  });
  const port = process.env.PORT || 3060;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/graphql`);
}
bootstrap();
