import { Injectable, LoggerService } from '@nestjs/common';
import { Logging } from '@google-cloud/logging';

export interface LogMetadata {
  [key: string]: any;
  context?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  tenantSlug?: string;
  requestId?: string;
  httpMethod?: string;
  httpUrl?: string;
  httpStatus?: number;
  duration?: number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
  };
}

@Injectable()
export class CloudLoggerService implements LoggerService {
  private gcpLogging: Logging | null = null;
  private logName: string;
  private projectId: string | undefined;
  private isProduction: boolean;
  private context?: string;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logName = process.env.GCP_LOG_NAME || 'the-polyclinic-api';
    this.projectId = process.env.GCP_PROJECT_ID;

    // Initialize Google Cloud Logging if project ID is provided
    // Can be enabled in development by setting GCP_PROJECT_ID
    const enableGcpLogging =
      process.env.GCP_ENABLE_IN_DEV === 'true' || this.isProduction;

    // temperarily log the credentials
    console.log(
      '[GCP] GCP_CREDENTIALS:',
      JSON.stringify(process.env.GCP_CREDENTIALS, null, 2),
    );

    const credentials = process.env.GCP_CREDENTIALS;

    if (this.projectId && enableGcpLogging) {
      try {
        if (credentials) {
          this.gcpLogging = new Logging({
            projectId: this.projectId,
            credentials: JSON.parse(credentials),
          });
        } else {
          this.gcpLogging = new Logging({
            projectId: this.projectId,
            // Credentials will be automatically detected from:
            // 1. GOOGLE_APPLICATION_CREDENTIALS environment variable
            // 2. GCP metadata service (when running on GCP)
            // 3. gcloud CLI credentials
          });
        }
      } catch (error) {
        console.error('Failed to initialize Google Cloud Logging:', error);
        // Fallback to console logging if GCP initialization fails
        this.gcpLogging = null;
      }
    }
  }

  setContext(context: string) {
    this.context = context;
  }

  private getSeverity(level: string): string {
    const severityMap: { [key: string]: string } = {
      error: 'ERROR',
      warn: 'WARNING',
      log: 'INFO',
      debug: 'DEBUG',
      verbose: 'DEBUG',
    };
    return severityMap[level] || 'INFO';
  }

  private detectGcpResourceType(): {
    type: string;
    labels: { [key: string]: string };
  } {
    // Detect Cloud Run
    if (process.env.K_SERVICE) {
      return {
        type: 'cloud_run_revision',
        labels: {
          project_id: this.projectId || '',
          service_name: process.env.K_SERVICE || '',
          revision_name: process.env.K_REVISION || '',
          location: process.env.K_CONFIGURATION || '',
        },
      };
    }

    // Detect App Engine
    if (process.env.GAE_SERVICE) {
      return {
        type: 'gae_app',
        labels: {
          project_id: this.projectId || '',
          module_id: process.env.GAE_SERVICE || '',
          version_id: process.env.GAE_VERSION || '',
        },
      };
    }

    // Detect GCE Instance
    if (process.env.GCE_INSTANCE) {
      return {
        type: 'gce_instance',
        labels: {
          project_id: this.projectId || '',
          instance_id: process.env.GCE_INSTANCE || '',
          zone: process.env.GCE_ZONE || '',
        },
      };
    }

    // Default to global resource
    return {
      type: 'global',
      labels: {
        project_id: this.projectId || '',
      },
    };
  }

  private async writeToGCP(
    severity: string,
    message: string,
    metadata?: LogMetadata,
  ): Promise<void> {
    if (!this.gcpLogging) {
      return;
    }

    try {
      const log = this.gcpLogging.log(this.logName);

      const entryMetadata: LogMetadata = {
        ...metadata,
        context: metadata?.context || this.context,
        service: 'the-polyclinic-api',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      };

      // Add trace context if available (for distributed tracing)
      if (process.env.GCP_TRACE_ID) {
        entryMetadata.traceId = process.env.GCP_TRACE_ID;
      }

      const resource = this.detectGcpResourceType();

      const entry = log.entry(
        {
          severity,
          resource,
          labels: {
            service: 'the-polyclinic-api',
            environment: process.env.NODE_ENV || 'development',
          },
        },
        {
          message,
          ...entryMetadata,
        },
      );

      await log.write(entry);
    } catch (error) {
      // Fallback to console if GCP write fails
      console.error('Failed to write to Google Cloud Logging:', error);
      this.logToConsole(severity, message, metadata);
    }
  }

  private logToConsole(
    severity: string,
    message: string,
    metadata?: LogMetadata,
  ): void {
    const context = metadata?.context || this.context || 'Application';
    const timestamp = new Date().toISOString();

    // Enhanced console logging with better formatting
    const logEntry: any = {
      timestamp,
      severity,
      context,
      message,
      ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
    };

    // Format for better readability in development
    const formattedLog = this.isProduction
      ? JSON.stringify(logEntry, null, 2)
      : this.formatConsoleLog(logEntry);

    switch (severity) {
      case 'ERROR':
        console.error(formattedLog);
        break;
      case 'WARNING':
        console.warn(formattedLog);
        break;
      case 'DEBUG':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(formattedLog);
        }
        break;
      default:
        console.log(formattedLog);
    }
  }

  private formatConsoleLog(logEntry: any): string {
    const { timestamp, severity, context, message, metadata } = logEntry;
    const time = new Date(timestamp).toLocaleTimeString();
    const severityColor = this.getSeverityColor(severity);

    let formatted = `\n${severityColor}[${time}] [${severity}] [${context}]${this.resetColor()} ${message}`;

    if (metadata && Object.keys(metadata).length > 0) {
      formatted += '\n' + JSON.stringify(metadata, null, 2);
    }

    return formatted;
  }

  private getSeverityColor(severity: string): string {
    const colors: { [key: string]: string } = {
      ERROR: '\x1b[31m', // Red
      WARNING: '\x1b[33m', // Yellow
      INFO: '\x1b[36m', // Cyan
      DEBUG: '\x1b[90m', // Gray
    };
    return colors[severity] || '';
  }

  private resetColor(): string {
    return '\x1b[0m';
  }

  async log(message: string, metadata?: LogMetadata): Promise<void> {
    const severity = this.getSeverity('log');
    if (this.gcpLogging) {
      // Fire and forget for GCP - don't block on logging
      this.writeToGCP(severity, message, metadata).catch(() => {
        // Fallback to console if GCP write fails
        this.logToConsole(severity, message, metadata);
      });
    }
    // Always log to console in development, or as fallback
    if (!this.gcpLogging || process.env.NODE_ENV !== 'production') {
      this.logToConsole(severity, message, metadata);
    }
  }

  async error(
    message: string,
    trace?: string,
    metadata?: LogMetadata,
  ): Promise<void> {
    const severity = this.getSeverity('error');
    const errorMetadata: LogMetadata = {
      ...metadata,
      error: {
        message: trace || message,
        stack: trace,
      },
    };

    if (this.gcpLogging) {
      this.writeToGCP(severity, message, errorMetadata).catch(() => {
        this.logToConsole(severity, message, errorMetadata);
      });
    }
    if (!this.gcpLogging || process.env.NODE_ENV !== 'production') {
      this.logToConsole(severity, message, errorMetadata);
    }
  }

  async warn(message: string, metadata?: LogMetadata): Promise<void> {
    const severity = this.getSeverity('warn');
    if (this.gcpLogging) {
      this.writeToGCP(severity, message, metadata).catch(() => {
        this.logToConsole(severity, message, metadata);
      });
    }
    if (!this.gcpLogging || process.env.NODE_ENV !== 'production') {
      this.logToConsole(severity, message, metadata);
    }
  }

  async debug(message: string, metadata?: LogMetadata): Promise<void> {
    const severity = this.getSeverity('debug');
    if (this.gcpLogging) {
      this.writeToGCP(severity, message, metadata).catch(() => {
        this.logToConsole(severity, message, metadata);
      });
    }
    if (!this.gcpLogging || process.env.NODE_ENV !== 'production') {
      this.logToConsole(severity, message, metadata);
    }
  }

  async verbose(message: string, metadata?: LogMetadata): Promise<void> {
    const severity = this.getSeverity('verbose');
    if (this.gcpLogging) {
      this.writeToGCP(severity, message, metadata).catch(() => {
        this.logToConsole(severity, message, metadata);
      });
    }
    if (!this.gcpLogging || process.env.NODE_ENV !== 'production') {
      this.logToConsole(severity, message, metadata);
    }
  }
}
