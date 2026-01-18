import { Module, Scope } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BearerStrategy } from './strategies/bearer.strategy';
import { RolesGuard } from './guards/roles.guard';
import { FieldRestrictionsGuard } from './guards/field-restrictions.guard';
import { TenantGuard } from './guards/tenant.guard';
import { User } from '../users/entities/user.entity';
import { UserTenant } from '../users/entities/user-tenant.entity';
import { Session } from './entities/session.entity';
import { Otp } from './entities/otp.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Patient } from '../patients/entities/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserTenant, Session, Otp, Tenant, Patient]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useClass: AuthService,
      scope: Scope.REQUEST,
    },
    BearerStrategy,
    RolesGuard,
    FieldRestrictionsGuard,
    TenantGuard,
  ],
  exports: [
    AuthService,
    BearerStrategy,
    RolesGuard,
    FieldRestrictionsGuard,
    TenantGuard,
    TypeOrmModule,
  ],
})
export class AuthModule {}
