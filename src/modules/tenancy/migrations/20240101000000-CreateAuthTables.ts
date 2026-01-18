import { DataSource } from 'typeorm';
import { TenantMigration } from '../interfaces/tenant-migration.interface';

/**
 * This migration now only creates the doctors table.
 * Users, sessions, and OTPs are now in the public schema.
 */
export class CreateAuthTables20240101000000 implements TenantMigration {
  version = '20240101000000';
  name = 'CreateAuthTables';

  async up(dataSource: DataSource, schemaName: string): Promise<void> {
    // Check if doctors table exists, create if not
    const doctorsTableExists = await dataSource.query(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'doctors'
      );
    `,
      [schemaName],
    );

    if (!doctorsTableExists[0].exists) {
      // Create doctors table with FK to public.users
      await dataSource.query(`
        CREATE TABLE "${schemaName}".doctors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL,
          code VARCHAR(3) UNIQUE,
          specialization VARCHAR,
          designation VARCHAR,
          departments TEXT[],
          experience INTEGER,
          education TEXT,
          biography TEXT,
          seating VARCHAR,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP,
          CONSTRAINT "FK_${schemaName}_doctors_userId" 
            FOREIGN KEY ("userId") 
            REFERENCES public.users(id) 
            ON DELETE CASCADE
        );
      `);

      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_doctors_userId" 
        ON "${schemaName}".doctors("userId");
      `);
    }
  }

  async down(dataSource: DataSource, schemaName: string): Promise<void> {
    await dataSource.query(
      `DROP TABLE IF EXISTS "${schemaName}".doctors CASCADE;`,
    );
  }
}
