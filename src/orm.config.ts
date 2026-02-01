import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

export const publicOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: 'public',
  entities: [
    join(__dirname, './modules/public/**/entities/*.entity.{ts,js}'),
    join(__dirname, './modules/auth/**/entities/*.entity.{ts,js}'),
    join(__dirname, './modules/common/**/entities/*.entity.{ts,js}'),
  ],
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  // ssl: {
  //   rejectUnauthorized: false,
  // },
};
