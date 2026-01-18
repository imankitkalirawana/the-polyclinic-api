import { DataSource } from 'typeorm';
import { TenantMigration } from '../interfaces/tenant-migration.interface';

/**
 * DEPRECATED: OTPs are now in the public schema.
 * This migration is kept for backwards compatibility but does nothing.
 */
export class CreateOtpsTable20240101000001 implements TenantMigration {
  version = '20240101000001';
  name = 'CreateOtpsTable';

  async up(_dataSource: DataSource, _schemaName: string): Promise<void> {
    // OTPs are now in the public schema - no tenant-specific table needed
  }

  async down(_dataSource: DataSource, _schemaName: string): Promise<void> {
    // No-op - OTPs are now in the public schema
  }
}
