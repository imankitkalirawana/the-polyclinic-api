import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getTenantSchemaName } from './tenancy.utils';
import { getTenantConnectionConfig } from '../../tenant-orm.config';

@Injectable()
export class TenantAuthInitService {
  private readonly logger = new Logger(TenantAuthInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Initialize auth tables for a tenant schema
   * This creates users and sessions tables with proper structure
   */
  async initializeTenantAuth(tenantSlug: string): Promise<void> {
    const schemaName = getTenantSchemaName(tenantSlug);
    this.logger.log(`Initializing auth tables for tenant: ${tenantSlug} (schema: ${schemaName})`);

    try {
      // Create schema if it doesn't exist
      await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create Role enum type if it doesn't exist in the tenant schema
      await this.createRoleEnum(schemaName);

      // Create users table
      await this.createUsersTable(schemaName);

      // Create sessions table
      await this.createSessionsTable(schemaName);

      // Create otps table
      await this.createOtpsTable(schemaName);

      this.logger.log(`Successfully initialized auth tables for tenant: ${tenantSlug}`);
    } catch (error) {
      this.logger.error(`Error initializing auth tables for tenant ${tenantSlug}:`, error);
      throw error;
    }
  }

  /**
   * Ensure auth tables exist for a tenant (idempotent)
   * Useful for existing tenants that might not have these tables
   */
  async ensureTenantAuthTables(tenantSlug: string): Promise<void> {
    const schemaName = getTenantSchemaName(tenantSlug);

    try {
      // Check if users table exists
      const usersTableExists = await this.tableExists(schemaName, 'users');
      const sessionsTableExists = await this.tableExists(schemaName, 'sessions');
      const otpsTableExists = await this.tableExists(schemaName, 'otps');

      if (!usersTableExists || !sessionsTableExists || !otpsTableExists) {
        this.logger.log(`Auth tables missing for tenant ${tenantSlug}, initializing...`);
        await this.initializeTenantAuth(tenantSlug);
      }
    } catch (error) {
      this.logger.error(`Error ensuring auth tables for tenant ${tenantSlug}:`, error);
      throw error;
    }
  }

  private async tableExists(schemaName: string, tableName: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      );
    `,
      [schemaName, tableName],
    );
    return result[0].exists;
  }

  private async createRoleEnum(schemaName: string): Promise<void> {
    // Check if enum type exists
    const enumExists = await this.dataSource.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'role' 
        AND typnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = $1
        )
      );
    `,
      [schemaName],
    );

    if (!enumExists[0].exists) {
      // Create enum in the tenant schema
      await this.dataSource.query(`
        CREATE TYPE "${schemaName}".role AS ENUM (
          'SUPERADMIN',
          'MODERATOR',
          'OPS',
          'ADMIN',
          'PATIENT',
          'DOCTOR',
          'NURSE',
          'RECEPTIONIST'
        );
      `);
      this.logger.log(`Created Role enum type in schema ${schemaName}`);
    }
  }

  private async createUsersTable(schemaName: string): Promise<void> {
    const tableExists = await this.tableExists(schemaName, 'users');
    if (tableExists) {
      this.logger.log(`Users table already exists in schema ${schemaName}`);
      return;
    }

    await this.dataSource.query(`
      CREATE TABLE "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR NOT NULL UNIQUE,
        password VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        role "${schemaName}".role NOT NULL DEFAULT 'PATIENT',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on email for faster lookups
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_users_email" 
      ON "${schemaName}".users(email);
    `);

    this.logger.log(`Created users table in schema ${schemaName}`);
  }

  private async createSessionsTable(schemaName: string): Promise<void> {
    const tableExists = await this.tableExists(schemaName, 'sessions');
    if (tableExists) {
      this.logger.log(`Sessions table already exists in schema ${schemaName}`);
      return;
    }

    await this.dataSource.query(`
      CREATE TABLE "${schemaName}".sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR NOT NULL,
        "userId" UUID NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_${schemaName}_sessions_userId" 
          FOREIGN KEY ("userId") 
          REFERENCES "${schemaName}".users(id) 
          ON DELETE CASCADE
      );
    `);

    // Create unique index on token
    await this.dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_${schemaName}_sessions_token" 
      ON "${schemaName}".sessions(token);
    `);

    // Create index on expiresAt for cleanup queries
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_sessions_expiresAt" 
      ON "${schemaName}".sessions("expiresAt");
    `);

    // Create index on userId for faster lookups
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_sessions_userId" 
      ON "${schemaName}".sessions("userId");
    `);

    this.logger.log(`Created sessions table in schema ${schemaName}`);
  }

  private async createOtpsTable(schemaName: string): Promise<void> {
    const tableExists = await this.tableExists(schemaName, 'otps');
    if (tableExists) {
      this.logger.log(`Otps table already exists in schema ${schemaName}`);
      return;
    }

    await this.dataSource.query(`
      CREATE TABLE "${schemaName}".otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR NOT NULL,
        code VARCHAR NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create composite index on email and code for faster lookups
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_otps_email_code" 
      ON "${schemaName}".otps(email, code);
    `);

    // Create composite index on email and verified for verification checks
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_otps_email_verified" 
      ON "${schemaName}".otps(email, verified);
    `);

    // Create index on expiresAt for cleanup queries
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${schemaName}_otps_expiresAt" 
      ON "${schemaName}".otps("expiresAt");
    `);

    this.logger.log(`Created otps table in schema ${schemaName}`);
  }

  /**
   * Initialize auth tables for all existing tenants
   * Useful for migration or fixing existing tenants
   */
  async initializeAllTenantsAuth(): Promise<void> {
    try {
      const tenants = await this.dataSource.query(`
        SELECT slug FROM public.tenants;
      `);

      this.logger.log(`Initializing auth tables for ${tenants.length} tenants...`);

      for (const tenant of tenants) {
        try {
          await this.ensureTenantAuthTables(tenant.slug);
        } catch (error) {
          this.logger.error(
            `Failed to initialize auth for tenant ${tenant.slug}:`,
            error,
          );
          // Continue with other tenants even if one fails
        }
      }

      this.logger.log('Finished initializing auth tables for all tenants');
    } catch (error) {
      this.logger.error('Error initializing auth for all tenants:', error);
      throw error;
    }
  }
}

