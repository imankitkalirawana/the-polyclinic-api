import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { publicOrmConfig } from './orm.config';

export const AppDataSource = new DataSource({
  ...publicOrmConfig,
  entities: [
    ...(Array.isArray(publicOrmConfig.entities)
      ? publicOrmConfig.entities
      : []),
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
});
