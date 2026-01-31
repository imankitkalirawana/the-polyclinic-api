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
      const tables = ['appointment_queue'];

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
      }
    } catch (error) {
      this.logger.error(`Error checking table '${tableName}':`, error);
    }
  }
}
