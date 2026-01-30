import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { join } from 'path';
import { DataSource, DataSourceOptions, Repository } from 'typeorm';
import { ClsService } from 'nestjs-cls';

import { SCHEMA_KEY } from 'src/libs/schema/schema.constants';
import { DataSourceConfig } from './datasource.config';
import { Company } from '@/auth/entities/company.entity';

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private dataSource: DataSource;

  constructor(
    @Inject(DataSourceConfig.KEY)
    private readonly dataSourceConfig: ConfigType<typeof DataSourceConfig>,
    private readonly cls: ClsService,
  ) {}

  private async initializeDataSource() {
    const options: DataSourceOptions = {
      type: 'postgres',
      host: this.dataSourceConfig.host,
      username: this.dataSourceConfig.username,
      password: this.dataSourceConfig.password,
      database: this.dataSourceConfig.database,
      port: this.dataSourceConfig.port,
      logging: this.dataSourceConfig.logging,
      entities: [
        join(__dirname, '../../modules/public/**/entities/*.entity.{ts,js}'),
        join(__dirname, '../../modules/auth/**/entities/*.entity.{ts,js}'),
        join(__dirname, '../../modules/client/**/entities/*.entity.{ts,js}'),
      ],
      migrations: [`${__dirname}/system-migrations/*{.ts,.js}`],
      migrationsRun: true,
      synchronize: false,
    };

    this.dataSource = new DataSource(options);
    await this.dataSource.initialize();
    this.logger.log('DataSource initialized (schema-level tenancy)');
  }

  private async ensureSchemaExists() {
    const companyRepository: Repository<Company> =
      this.dataSource.getRepository(Company);
    const companies = await companyRepository.find({
      select: ['id', 'schema', 'company_code'],
    });

    for (const company of companies) {
      if (company.schema) {
        await this.dataSource.query(
          `CREATE SCHEMA IF NOT EXISTS "${company.schema.replace(/"/g, '""')}"`,
        );
        this.logger.debug(`Ensured schema exists: ${company.schema}`);
      }
    }
  }

  async onModuleInit() {
    await this.initializeDataSource();
    await this.ensureSchemaExists();
  }

  async onModuleDestroy() {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('DataSource closed');
    }
  }

  /**
   * Get the shared DataSource. Schema isolation is via schema (use getSchema() / runWithSchema).
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * Get the current schema from request context (e.g. x-schema header).
   */
  getSchema(): string | undefined {
    return this.cls.get<string>(SCHEMA_KEY);
  }

  /**
   * Run a function with the given schema set as search_path. Restores previous path after.
   */
  async runWithSchema<T>(schema: string, fn: () => Promise<T>): Promise<T> {
    const quoted = `"${schema.replace(/"/g, '""')}"`;
    await this.dataSource.query(`SET search_path TO ${quoted}`);
    try {
      return await fn();
    } finally {
      await this.dataSource.query('SET search_path TO public');
    }
  }
}
