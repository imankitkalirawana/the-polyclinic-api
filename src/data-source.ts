import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { publicOrmConfig } from './orm.config';
import { User } from './users/entities/user.entity';
import { Session } from './auth/entities/session.entity';
import { Otp } from './auth/entities/otp.entity';
import { Tenant } from './modules/public/tenants/entities/tenant.entity';

export const AppDataSource = new DataSource({
  ...publicOrmConfig,
  entities: [
    ...(Array.isArray(publicOrmConfig.entities)
      ? (publicOrmConfig.entities as any[])
      : []),
    User,
    Session,
    Otp,
    Tenant,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  migrationsRun: false,
});
