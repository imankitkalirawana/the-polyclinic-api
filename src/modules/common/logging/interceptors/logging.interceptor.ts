import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CloudLoggerService, LogMetadata } from '../cloud-logger.service';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CloudLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body, query, headers } = request;
    const startTime = Date.now();

    // Generate or use existing request ID
    const requestIdHeader =
      headers['x-request-id'] ||
      headers['x-correlation-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : requestIdHeader;

    // Set request ID in response headers
    response.setHeader('x-request-id', requestId);

    // Extract tenant slug if available
    const tenantSlug = (request as any).tenantSlug;

    // Extract user ID if available (from JWT or session)
    const userId = (request as any).user?.id || (request as any).user?.userId;

    // Sanitize headers (remove sensitive information)
    const sanitizedHeaders = this.sanitizeHeaders(headers);

    // Anonymize IP address for privacy (GDPR compliance)
    const rawIp = request.ip || headers['x-forwarded-for'] || 'unknown';
    const anonymizedIp = this.anonymizeIp(rawIp);

    // Get user agent (can be anonymized if needed)
    const userAgent = headers['user-agent'] || 'unknown';
    const shouldAnonymizeDeviceInfo =
      process.env.LOG_ANONYMIZE_DEVICE_INFO === 'true';

    // Log request
    const requestMetadata: LogMetadata = {
      requestId,
      httpMethod: method,
      httpUrl: url,
      tenantSlug,
      userId,
      // Don't log sensitive data
      ...(body &&
        Object.keys(body).length > 0 && {
          body: this.sanitizeBody(body),
        }),
      ...(query && Object.keys(query).length > 0 && { query }),
      headers: sanitizedHeaders,
      ...(shouldAnonymizeDeviceInfo
        ? { userAgent: this.anonymizeUserAgent(userAgent) }
        : { userAgent }),
      ip: anonymizedIp,
    };

    this.logger.log(`Incoming ${method} ${url}`, requestMetadata);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const responseMetadata: LogMetadata = {
          requestId,
          httpMethod: method,
          httpUrl: url,
          httpStatus: response.statusCode,
          duration,
          tenantSlug,
          userId,
          responseHeaders: this.sanitizeHeaders(response.getHeaders()),
        };

        if (response.statusCode >= 400) {
          this.logger.warn(
            `${method} ${url} ${response.statusCode} - ${duration}ms`,
            responseMetadata,
          );
        } else {
          this.logger.debug(
            `${method} ${url} ${response.statusCode} - ${duration}ms`,
            responseMetadata,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const errorMetadata: LogMetadata = {
          requestId,
          httpMethod: method,
          httpUrl: url,
          httpStatus: error.status || 500,
          duration,
          tenantSlug,
          userId,
          responseHeaders: this.sanitizeHeaders(response.getHeaders()),
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.status || error.code,
          },
        };

        this.logger.error(
          `${method} ${url} ${error.status || 500} - ${duration}ms`,
          error.stack,
          errorMetadata,
        );

        throw error;
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'apikey',
      'authorization',
      'creditCard',
      'cvv',
      'ssn',
      'socialSecurityNumber',
    ];

    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers || typeof headers !== 'object') {
      return headers;
    }

    const sensitiveHeaderFields = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-access-token',
      'x-refresh-token',
      'authentication',
    ];

    const sanitized: any = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveHeaderFields.some((field) => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else {
        // Convert array values to single string for readability
        sanitized[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    return sanitized;
  }

  /**
   * Anonymize IP address for privacy compliance (GDPR)
   * IPv4: Masks last octet (e.g., 192.168.1.100 -> 192.168.1.0)
   * IPv6: Masks last 64 bits (e.g., 2001:db8::1 -> 2001:db8::)
   * Multiple IPs (from proxy): Anonymizes first IP
   */
  private anonymizeIp(ip: string | string[]): string {
    if (!ip || ip === 'unknown') {
      return 'unknown';
    }

    // If anonymization is disabled, return original
    if (process.env.LOG_ANONYMIZE_IP === 'false') {
      return Array.isArray(ip) ? ip[0] : ip;
    }

    const ipString = Array.isArray(ip) ? ip[0] : ip;

    // Handle IPv4
    if (ipString.includes('.')) {
      const parts = ipString.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }

    // Handle IPv6
    if (ipString.includes(':')) {
      const parts = ipString.split(':');
      // Keep first 4 groups, mask the rest
      if (parts.length > 4) {
        return parts.slice(0, 4).join(':') + '::';
      }
      // For shorter IPv6 addresses, return as-is (already anonymized enough)
      return ipString;
    }

    // If format is unrecognized, return as-is (better than failing)
    return ipString;
  }

  /**
   * Anonymize user agent to only show browser/OS type, not version
   * Example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -> "Browser: Chrome-like, OS: Windows"
   */
  private anonymizeUserAgent(userAgent: string): string {
    if (!userAgent || userAgent === 'unknown') {
      return 'unknown';
    }

    const ua = userAgent.toLowerCase();
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser type (not version)
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome-like';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox-like';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari-like';
    } else if (ua.includes('edg')) {
      browser = 'Edge-like';
    } else if (ua.includes('opera')) {
      browser = 'Opera-like';
    }

    // Detect OS type (not version)
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('mac')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
    }

    return `Browser: ${browser}, OS: ${os}`;
  }
}
