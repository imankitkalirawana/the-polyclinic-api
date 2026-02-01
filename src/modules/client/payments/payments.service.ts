import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  Payment,
  PaymentProvider,
  PaymentReferenceType,
  PaymentStatus,
} from './entities/payment.entity';
import {
  Queue,
  QueueStatus,
} from '../appointments/queue/entities/queue.entity';
import { RazorpayService } from './razorpay.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { getTenantConnection } from 'src/common/db/tenant-connection';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly razorpayService: RazorpayService,
  ) {}

  private getTenantSlug(): string {
    const schema = this.request?.schema;
    if (!schema) {
      throw new UnauthorizedException('Schema is required');
    }
    return schema;
  }

  private async getPaymentRepository(): Promise<Repository<Payment>> {
    const connection = await getTenantConnection(this.getTenantSlug());
    return connection.getRepository(Payment);
  }

  private async getQueueRepository(): Promise<Repository<Queue>> {
    const connection = await getTenantConnection(this.getTenantSlug());
    return connection.getRepository(Queue);
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    // first call razorpay to create order
    const order = await this.razorpayService.createOrder(
      createPaymentDto.amount,
    );

    const paymentRepo = await this.getPaymentRepository();
    const payment = paymentRepo.create({
      ...createPaymentDto,
      provider: PaymentProvider.RAZORPAY,
      referenceType: PaymentReferenceType.APPOINTMENT_QUEUE,
      referenceId: createPaymentDto.referenceId,
      orderId: order.id,
    });
    await paymentRepo.save(payment);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const paymentRepo = await this.getPaymentRepository();

    const payment = await paymentRepo.findOne({
      where: { orderId: dto.orderId },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    const isValid = this.razorpayService.verifySignature(
      dto.orderId,
      dto.paymentId,
      dto.signature,
    );

    if (!isValid) {
      payment.status = PaymentStatus.FAILED;
      await paymentRepo.save(payment);
      throw new BadRequestException('Invalid payment signature');
    }

    payment.paymentId = dto.paymentId;
    payment.signature = dto.signature;
    payment.status = PaymentStatus.PAID;

    const savedPayment = await paymentRepo.save(payment);

    return savedPayment;
  }

  async handleWebhookEvent(webhookPayload: Record<string, unknown>) {
    const paymentRepo = await this.getPaymentRepository();
    const queueRepo = await this.getQueueRepository();

    const event = webhookPayload.event;

    if (event === 'payment.captured') {
      await this.handlePaymentCaptured(webhookPayload, paymentRepo, queueRepo);
    } else if (event === 'payment.failed') {
      await this.handlePaymentFailed(webhookPayload, paymentRepo);
    } else {
      this.logger.log(`Ignoring unknown webhook event: ${event}`);
    }
  }

  private async handlePaymentCaptured(
    // TODO: Fix this type
    webhookPayload: any,
    paymentRepo: Repository<Payment>,
    queueRepo: Repository<Queue>,
  ) {
    const paymentData = webhookPayload.payload.payment.entity;
    const orderId = paymentData.order_id;

    if (!orderId) {
      this.logger.warn('Payment captured event missing order_id');
      return;
    }

    const payment = await paymentRepo.findOne({
      where: { orderId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for orderId: ${orderId}`);
      return;
    }

    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`Payment already PAID for orderId: ${orderId}`);
      return;
    }

    payment.paymentId = paymentData.id;
    payment.status = PaymentStatus.PAID;

    await paymentRepo.save(payment);

    await queueRepo.update(
      { id: payment.referenceId },
      {
        status: QueueStatus.BOOKED,
      },
    );

    this.logger.log(
      `Payment captured and appointment confirmed for orderId: ${orderId}`,
    );
  }

  private async handlePaymentFailed(
    // TODO: fix this type
    webhookPayload: any,
    paymentRepo: Repository<Payment>,
  ) {
    const paymentData = webhookPayload.payload.payment.entity;
    const orderId = paymentData.order_id;

    if (!orderId) {
      this.logger.warn('Payment failed event missing order_id');
      return;
    }

    const payment = await paymentRepo.findOne({
      where: { orderId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for orderId: ${orderId}`);
      return;
    }

    payment.paymentId = paymentData.id;
    payment.status = PaymentStatus.FAILED;

    await paymentRepo.save(payment);

    this.logger.log(`Payment failed for orderId: ${orderId}`);
  }
}
