/**
 * Google Cloud Logging Module
 *
 * This module provides production-grade logging integration with Google Cloud Logging.
 *
 * Features:
 * - Automatic structured logging to Google Cloud Logging in production
 * - Console logging fallback in development
 * - HTTP request/response logging with metadata
 * - Exception filtering and error tracking
 * - Request ID correlation
 * - Sensitive data sanitization
 *
 * Environment Variables:
 * - GCP_PROJECT_ID: Your Google Cloud Project ID (required for production)
 * - GCP_LOG_NAME: Log name in Cloud Logging (default: 'the-polyclinic-api')
 * - GCP_ENABLE_IN_DEV: Set to 'true' to enable GCP logging in development (default: false)
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON key file (optional, uses default credentials if not set)
 * - NODE_ENV: Set to 'production' to enable GCP logging automatically
 * - LOG_ANONYMIZE_IP: Set to 'false' to disable IP anonymization (default: true, anonymizes last octet for IPv4)
 * - LOG_ANONYMIZE_DEVICE_INFO: Set to 'true' to anonymize user agent (default: false, shows full user agent)
 *
 * Usage in Services:
 * ```typescript
 * import { Injectable } from '@nestjs/common';
 * import { CloudLoggerService } from '@/modules/common/logging/cloud-logger.service';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly logger: CloudLoggerService) {
 *     this.logger.setContext('MyService');
 *   }
 *
 *   async doSomething() {
 *     this.logger.log('Doing something', { userId: '123', action: 'doSomething' });
 *
 *     try {
 *       // your code
 *     } catch (error) {
 *       this.logger.error('Failed to do something', error.stack, {
 *         userId: '123',
 *         error: { name: error.name, message: error.message }
 *       });
 *     }
 *   }
 * }
 * ```
 */

export { CloudLoggerService } from './cloud-logger.service';
export { LoggingModule } from './logging.module';
export { LoggingInterceptor } from './interceptors/logging.interceptor';
export { LoggingExceptionFilter } from './filters/logging-exception.filter';
export type { LogMetadata } from './cloud-logger.service';
