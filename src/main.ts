import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { TenancyMiddleware } from './modules/tenancy/tenancy.middleware';
import { CloudLoggerService } from './modules/common/logging/cloud-logger.service';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use custom logger
  const logger = app.get(CloudLoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);
  app.setGlobalPrefix('api/v1');
  // Raw body parser for Razorpay webhook endpoint
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json' }),
  );

  app.use(new TenancyMiddleware().use.bind(new TenancyMiddleware()));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedRegex =
        /^https?:\/\/([a-z0-9-]+\.)?(localhost:3000|lvh\.me:3000|thepolyclinic\.app)(:\d+)?$/i;

      if (allowedRegex.test(origin)) {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((error) => {
            const firstConstraint = Object.values(error.constraints || {})[0];
            return firstConstraint;
          })
          .filter(Boolean); // Remove any undefined values

        return new BadRequestException({
          message: messages,
          error: 'Bad Request',
          statusCode: 400,
        });
      },
    }),
  );

  const port = process.env.PORT ?? 8000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Application is running on: http://0.0.0.0:${port}/api/v1`, {
    port,
    environment: process.env.NODE_ENV || 'development',
    gcpLoggingEnabled:
      process.env.NODE_ENV === 'production' && !!process.env.GCP_PROJECT_ID,
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error.stack, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Rejection', error.stack, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      promise: String(promise),
    });
  });
}
bootstrap();
