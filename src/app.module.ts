import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
// import { APP_GUARD } from '@nestjs/core';
// import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { publicOrmConfig } from './orm.config';
import { DatabaseInitService } from './common/database-init.service';
// Common modules (centralized user management)
import { AuthModule } from './modules/common/auth/auth.module';
import { UsersModule } from './modules/common/users/users.module';
import { PatientsModule } from './modules/common/patients/patients.module';
import { TenantsModule } from './modules/common/tenants/tenants.module';
// Tenant-specific modules
import { DoctorsModule } from './modules/client/doctors/doctors.module';
import { QueueModule } from './modules/client/appointments/queue/queue.module';
import { PaymentsModule } from './modules/client/payments/payments.module';
// Other common modules
import { ActivityModule } from './modules/common/activity/activity.module';
import { CronModule } from './modules/common/cron/cron.module';
import { EmailModule } from './modules/common/email/email.module';
import { LoggingModule } from './modules/common/logging/logging.module';
// Middleware
import { TenancyMiddleware } from './modules/tenancy/tenancy.middleware';
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
      signOptions: { expiresIn: '7d' },
      global: true,
    }),
    // Common modules (centralized user management in public schema)
    AuthModule,
    UsersModule,
    PatientsModule,
    TenantsModule,
    // Tenant-specific modules (doctors, appointments, payments in tenant schema)
    DoctorsModule,
    QueueModule,
    PaymentsModule,
    // Other common modules
    ActivityModule,
    CronModule,
    EmailModule,
    LoggingModule,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
