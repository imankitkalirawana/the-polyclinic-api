import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.ensureTablesExist();
  }

  private async ensureTablesExist() {
    try {
      const tables = ['users', 'sessions', 'otps', 'tenants'];

      for (const tableName of tables) {
        await this.ensureTableExists(tableName);
      }
    } catch (error) {
      this.logger.error('Error ensuring tables exist:', error);
      // Don't throw - allow app to start even if table creation fails
      // This prevents blocking startup if there are permission issues
    }
  }

  private async ensureTableExists(tableName: string) {
    try {
      const result = await this.dataSource.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `,
        [tableName],
      );

      if (!result[0].exists) {
        this.logger.warn(
          `Table '${tableName}' does not exist in the database.`,
        );
        this.logger.warn(
          `If this is a fresh database, you may want to enable synchronize for development.`,
        );
        this.logger.warn(
          `Otherwise, please create the table manually or use migrations.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error checking table '${tableName}':`, error);
    }
  }
}
