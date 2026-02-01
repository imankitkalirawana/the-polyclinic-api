import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

interface TenantRequest extends Request {
  tenantSlug?: string;
}

@Controller('payments')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: TenantRequest,
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    try {
      const rawBody = req.body as Buffer;

      if (!signature) {
        this.logger.warn('Webhook request missing signature header');
        return res.status(200).json({ received: true });
      }

      const isValid = this.razorpayService.verifyWebhookSignature(
        rawBody,
        signature,
      );

      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
        return res.status(200).json({ received: true });
      }

      const webhookPayload = JSON.parse(rawBody.toString('utf8'));
      const event = webhookPayload.event;

      this.logger.log(`Received webhook event: ${event}`);

      const tenantSlug = await this.resolveTenantFromWebhook(webhookPayload);
      if (tenantSlug) {
        req.tenantSlug = tenantSlug;
      } else {
        this.logger.warn('Could not resolve tenant from webhook payload');
        return res.status(200).json({ received: true });
      }

      await this.paymentsService.handleWebhookEvent(webhookPayload);

      return res.status(200).json({ received: true });
    } catch (error) {
      this.logger.error('Error processing webhook', error);
      return res.status(200).json({ received: true });
    }
  }

  private async resolveTenantFromWebhook(
    // TODO: fix this type
    webhookPayload: any,
  ): Promise<string | null> {
    try {
      const orderId =
        webhookPayload.payload?.payment?.entity?.order_id ||
        webhookPayload.payload?.order?.entity?.id;

      if (!orderId) {
        this.logger.warn('Order ID not found in webhook payload');
        return null;
      }

      // Try to get tenant from order receipt in webhook payload first
      const receipt = webhookPayload.payload?.order?.entity?.receipt;

      if (receipt) {
        // If receipt format is "tenant-slug:order-id" or contains tenant info
        const parts = receipt.split(':');
        if (parts.length >= 2) {
          return parts[0];
        }
      }

      // Fallback: Query Razorpay API for order details
      const order = await this.razorpayService.getOrder(orderId);
      if (order.receipt) {
        const parts = order.receipt.split(':');
        if (parts.length >= 2) {
          return parts[0];
        }
      }

      this.logger.warn(
        `Could not extract tenant from order receipt: ${orderId}`,
      );
      return null;
    } catch (error) {
      this.logger.error('Error resolving tenant from webhook', error);
      return null;
    }
  }
}
