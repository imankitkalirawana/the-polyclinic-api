import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments.webhook.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { AuthModule } from '../../common/auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { Tenant } from '../../common/tenants/entities/tenant.entity';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant], 'default'),
    AuthModule,
    TenancyModule,
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService, RazorpayService, TenantAuthInitService],
  exports: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
