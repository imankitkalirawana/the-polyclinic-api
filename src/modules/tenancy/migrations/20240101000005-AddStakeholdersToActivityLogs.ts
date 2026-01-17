import { DataSource } from 'typeorm';
import { TenantMigration } from '../interfaces/tenant-migration.interface';

export class AddStakeholdersToActivityLogs20240101000005 implements TenantMigration {
  version = '20240101000005';
  name = 'AddStakeholdersToActivityLogs';

  async up(dataSource: DataSource, schemaName: string): Promise<void> {
    // Check if stakeholders column exists
    const stakeholdersColumnExists = await dataSource.query(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = $1 
        AND table_name = 'activity_logs'
        AND column_name = 'stakeholders'
      );
    `,
      [schemaName],
    );

    if (!stakeholdersColumnExists[0].exists) {
      // Add stakeholders column as JSONB with default empty array
      await dataSource.query(`
        ALTER TABLE "${schemaName}".activity_logs 
        ADD COLUMN stakeholders JSONB DEFAULT '[]'::jsonb;
      `);

      // Create GIN index for efficient JSONB array queries
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_activity_logs_stakeholders" 
        ON "${schemaName}".activity_logs USING GIN (stakeholders);
      `);
    }
  }

  async down(dataSource: DataSource, schemaName: string): Promise<void> {
    await dataSource.query(`
      DROP INDEX IF EXISTS "${schemaName}"."IDX_${schemaName}_activity_logs_stakeholders";
    `);

    await dataSource.query(`
      ALTER TABLE "${schemaName}".activity_logs 
      DROP COLUMN IF EXISTS stakeholders;
    `);
  }
}
