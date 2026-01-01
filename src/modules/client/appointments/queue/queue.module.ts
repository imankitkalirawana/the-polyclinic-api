import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AuthModule } from '../../auth/auth.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { Tenant } from '../../../public/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../../tenancy/tenant-auth-init.service';
import { PaymentsModule } from '../../payments/payments.module';
import { PdfModule } from '../../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    AuthModule,
    TenancyModule,
    PaymentsModule,
    PdfModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, TenantAuthInitService],
  exports: [QueueService],
})
export class QueueModule {}
