import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { AuthModule } from '../../common/auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { Tenant } from '../../common/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { UsersModule } from '../../common/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    forwardRef(() => AuthModule),
    TenancyModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [DoctorsController],
  providers: [DoctorsService, TenantAuthInitService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
