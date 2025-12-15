import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { User } from './users/entities/user.entity';
import { Session } from './auth/entities/session.entity';
import { Otp } from './auth/entities/otp.entity';
import { Tenant } from './modules/public/tenants/entities/tenant.entity';
import { TenantsModule } from './modules/public/tenants/tenants.module';
import { CatsModule } from './modules/tenanted/cats/cats.module';
import { publicOrmConfig } from './orm.config';
import { DatabaseInitService } from './common/database-init.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    TypeOrmModule.forRoot({
      ...publicOrmConfig,
      // Keep existing entities for backward compatibility
      entities: [
        ...(Array.isArray(publicOrmConfig.entities)
          ? (publicOrmConfig.entities as any[])
          : []),
        User,
        Session,
        Otp,
        Tenant,
      ],
      // Migrations are now enabled - use 'pnpm migration:run' to run migrations
      // Use 'pnpm migration:generate -- -n MigrationName' to generate new migrations
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN as any },
      global: true,
    }),
    TenantsModule,
    CatsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseInitService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
