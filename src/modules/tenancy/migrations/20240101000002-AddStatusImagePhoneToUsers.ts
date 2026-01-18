import { DataSource } from 'typeorm';
import { TenantMigration } from '../interfaces/tenant-migration.interface';

/**
 * DEPRECATED: Users are now in the public schema.
 * This migration is kept for backwards compatibility but does nothing.
 */
export class AddStatusImagePhoneToUsers20240101000002 implements TenantMigration {
  version = '20240101000002';
  name = 'AddStatusImagePhoneToUsers';

  async up(_dataSource: DataSource, _schemaName: string): Promise<void> {
    // Users are now in the public schema - no tenant-specific changes needed
  }

  async down(_dataSource: DataSource, _schemaName: string): Promise<void> {
    // No-op - Users are now in the public schema
  }
}
