import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { CloudLoggerService } from './cloud-logger.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { LoggingExceptionFilter } from './filters/logging-exception.filter';

@Global()
@Module({
  providers: [
    CloudLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: LoggingExceptionFilter,
    },
  ],
  exports: [CloudLoggerService],
})
export class LoggingModule {}
