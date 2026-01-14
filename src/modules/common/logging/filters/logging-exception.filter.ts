import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CloudLoggerService, LogMetadata } from '../cloud-logger.service';

@Catch()
export class LoggingExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: CloudLoggerService) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const error =
      exception instanceof Error ? exception : new Error(String(exception));

    const requestId =
      request.headers['x-request-id'] ||
      request.headers['x-correlation-id'] ||
      'unknown';

    const tenantSlug = (request as any).tenantSlug;
    const userId = (request as any).user?.id || (request as any).user?.userId;

    const errorMetadata: LogMetadata = {
      requestId: String(requestId),
      httpMethod: request.method,
      httpUrl: request.url,
      httpStatus: status,
      tenantSlug,
      userId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: status,
      },
      ...(typeof message === 'object' && { response: message }),
    };

    // Log error with appropriate level
    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${error.message}`,
        error.stack,
        errorMetadata,
      );
    } else {
      this.logger.warn(`Client error: ${error.message}`, errorMetadata);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: String(requestId),
      ...(typeof message === 'object' ? message : { message }),
    });
  }
}
