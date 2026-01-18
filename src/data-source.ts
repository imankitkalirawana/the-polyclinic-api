import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { publicOrmConfig } from './orm.config';
import { Tenant } from './modules/common/tenants/entities/tenant.entity';

export const AppDataSource = new DataSource({
  ...publicOrmConfig,
  entities: [
    ...(Array.isArray(publicOrmConfig.entities)
      ? (publicOrmConfig.entities as any[])
      : []),
    Tenant,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
});
