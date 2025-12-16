import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Tenant } from '@/public/tenants/entities/tenant.entity';
import { TenantsModule } from '@/public/tenants/tenants.module';
import { CatsModule } from '@/tenanted/cats/cats.module';
import { publicOrmConfig } from './orm.config';
import { DatabaseInitService } from './common/database-init.service';
import { AuthModule as PublicAuthModule } from './modules/public/auth/auth.module';
import { AuthModule as TenantedAuthModule } from './modules/tenanted/auth/auth.module';

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
      synchronize: false,
    }),
    JwtModule.register({
      secret:
        '8f2b5e4317f4e50d25df2d9bfe536d58a7dd7912fbdc6fb8fb32bdc19f3bbe4e',
      signOptions: { expiresIn: '1h' },
      global: true,
    }),
    TenantsModule,
    PublicAuthModule,
    TenantedAuthModule,
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
