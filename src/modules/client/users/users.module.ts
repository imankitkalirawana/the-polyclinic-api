import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { Tenant } from '../../public/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { PatientsModule } from '../patients/patients.module';
import { DoctorsModule } from '../doctors/doctors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    PassportModule.register({ defaultStrategy: 'tenant-bearer' }),
    AuthModule,
    TenancyModule,
    PatientsModule,
    forwardRef(() => DoctorsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, TenantAuthInitService],
  exports: [UsersService],
})
export class UsersModule {}
