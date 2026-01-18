import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AuthModule } from '../../../common/auth/auth.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { Tenant } from '../../../common/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../../tenancy/tenant-auth-init.service';
import { PaymentsModule } from '../../payments/payments.module';
import { PdfModule } from '../../pdf/pdf.module';
import { DoctorsModule } from '../../doctors/doctors.module';
import { QrModule } from '../../qr/qr.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    AuthModule,
    TenancyModule,
    PaymentsModule,
    PdfModule,
    DoctorsModule,
    QrModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, TenantAuthInitService],
  exports: [QueueService],
})
export class QueueModule {}
