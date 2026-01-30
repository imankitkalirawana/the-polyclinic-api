import { Module } from '@nestjs/common';
// import { APP_GUARD } from '@nestjs/core';
// import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { publicOrmConfig } from './orm.config';
import { DatabaseInitService } from './common/database-init.service';
import { PatientsModule } from './modules/client/patients/patients.module';
import { PaymentsModule } from './modules/client/payments/payments.module';
import { DoctorsModule } from './modules/client/doctors/doctors.module';
import { QueueModule } from './modules/client/appointments/queue/queue.module';
import { ActivityModule } from './modules/common/activity/activity.module';
import { CronModule } from './modules/common/cron/cron.module';
import { EmailModule } from './modules/common/email/email.module';
import { LoggingModule } from './modules/common/logging/logging.module';
import { AuthModule } from './modules/auth/auth.module';
import { SchemaModule } from './libs/schema/schema.module';
import { DatabaseModule } from './libs/database/database.module';
import { ConfigModule } from '@nestjs/config';

import {
  StandardResponseModule,
  StandardResponseModuleOptions,
} from 'nest-standard-response';

const options: StandardResponseModuleOptions = {};

@Module({
  imports: [
    // ThrottlerModule.forRoot([
    //   {
    //     ttl: 60000, // 1 minute
    //     limit: process.env.NODE_ENV === 'production' ? 10 : 100, // 10 requests per minute
    //   },
    // ]),
    StandardResponseModule.forRoot(options),
    TypeOrmModule.forRoot({
      ...publicOrmConfig,
      entities: [
        ...(Array.isArray(publicOrmConfig.entities)
          ? publicOrmConfig.entities
          : []),
      ],
      // Migrations are now enabled - use 'pnpm migration:run' to run migrations
      // Use 'pnpm migration:generate -- -n MigrationName' to generate new migrations
      synchronize: true,
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
      global: true,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PatientsModule,
    DoctorsModule,
    QueueModule,
    PaymentsModule,
    ActivityModule,
    CronModule,
    EmailModule,
    LoggingModule,
    SchemaModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseInitService,
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ],
})
export class AppModule {}
