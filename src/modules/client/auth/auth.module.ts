import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BearerStrategy } from './strategies/bearer.strategy';
import { RolesGuard } from './guards/roles.guard';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { Tenant } from '../../public/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { DoctorsModule } from '../doctors/doctors.module';
import { EmailModule } from '@/common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    PassportModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    TenancyModule,
    forwardRef(() => DoctorsModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, BearerStrategy, RolesGuard, TenantAuthInitService],
  exports: [AuthService, BearerStrategy, RolesGuard],
})
export class AuthModule {}
