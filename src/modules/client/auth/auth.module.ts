import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BearerStrategy } from './strategies/bearer.strategy';
import { RolesGuard } from './guards/roles.guard';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { SessionCleanupService } from './session-cleanup.service';
import { Tenant } from '../../public/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    ScheduleModule.forRoot(),
    TenancyModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    BearerStrategy,
    RolesGuard,
    SessionCleanupService,
    TenantAuthInitService,
  ],
  exports: [AuthService, BearerStrategy, RolesGuard],
})
export class AuthModule {}
