import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

export function getTenantConnectionConfig(
  tenantSlug: string,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: `tenant_${tenantSlug}`,
    entities: [
      join(__dirname, './modules/tenanted/**/entities/*.entity.{ts,js}'),
    ],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };
}
