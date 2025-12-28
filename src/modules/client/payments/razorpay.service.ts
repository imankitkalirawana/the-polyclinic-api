import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Razorpay = require('razorpay');
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly razorpay: Razorpay;
  private readonly logger = new Logger(RazorpayService.name);

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  /**
   * Create Razorpay order
   * @param amountInRupees Amount in INR
   * @param receipt Receipt for the order
   */
  async createOrder(amountInRupees: number, receipt: string) {
    try {
      return await this.razorpay.orders.create({
        amount: amountInRupees * 100, // convert to paise
        currency: 'INR',
        receipt,
        payment_capture: true,
      });
    } catch (error) {
      this.logger.error('Failed to create Razorpay order', error);
      throw new InternalServerErrorException(
        'Failed to create Razorpay order',
        error,
      );
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  verifySignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const payload = `${orderId}|${paymentId}`;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }
}
