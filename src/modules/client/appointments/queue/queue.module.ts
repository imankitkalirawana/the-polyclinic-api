import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AuthModule } from '../../auth/auth.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { Tenant } from '../../../public/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../../tenancy/tenant-auth-init.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    AuthModule,
    TenancyModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, TenantAuthInitService],
  exports: [QueueService],
})
export class QueueModule {}
