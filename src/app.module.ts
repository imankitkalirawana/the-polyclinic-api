import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Tenant } from '@/public/tenants/entities/tenant.entity';
import { TenantsModule } from '@/public/tenants/tenants.module';
import { CatsModule } from '@/client/cats/cats.module';
import { publicOrmConfig } from './orm.config';
import { DatabaseInitService } from './common/database-init.service';
import { AuthModule as PublicAuthModule } from './modules/public/auth/auth.module';
import { AuthModule as TenantedAuthModule } from './modules/client/auth/auth.module';
import { UsersModule as PublicUsersModule } from './modules/public/users/users.module';
import { UsersModule as TenantedUsersModule } from './modules/client/users/users.module';

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
        Tenant,
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
    TenantsModule,
    PublicAuthModule,
    PublicUsersModule,
    TenantedAuthModule,
    TenantedUsersModule, // Must be after TenantedAuthModule for strategy registration
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
  ],
})
export class AppModule {}
