import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { BearerAuthGuard } from '../../common/auth/guards/bearer-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('client/payments')
@UseGuards(BearerAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('verify')
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
  }
}
