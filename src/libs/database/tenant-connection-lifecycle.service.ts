import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { closeAllTenantConnections } from 'src/common/db/tenant-connection';

/**
 * Ensures all tenant DataSource connections are closed when the app shuts down.
 * Requires app.enableShutdownHooks() in main.ts for SIGTERM/SIGINT to trigger this.
 */
@Injectable()
export class TenantConnectionLifecycleService implements OnApplicationShutdown {
  private readonly logger = new Logger(TenantConnectionLifecycleService.name);

  async onApplicationShutdown() {
    try {
      await closeAllTenantConnections();
      this.logger.log('All tenant connections closed');
    } catch (error) {
      this.logger.warn('Error closing tenant connections', error);
    }
  }
}
