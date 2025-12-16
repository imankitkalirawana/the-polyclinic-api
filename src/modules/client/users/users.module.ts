import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { Tenant } from '../../public/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    PassportModule.register({ defaultStrategy: 'tenant-bearer' }),
    AuthModule,
    TenancyModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, TenantAuthInitService],
  exports: [UsersService],
})
export class UsersModule {}
