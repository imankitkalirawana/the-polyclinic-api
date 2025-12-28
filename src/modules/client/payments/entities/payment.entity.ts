import { BaseEntity } from 'src/common/entity/base.entity';
import { Entity, Column } from 'typeorm';

/**
 * Payment Provider
 */
export enum PaymentProvider {
  RAZORPAY = 'RAZORPAY',
  CASH = 'CASH',
}

/**
 * Payment Status
 */
export enum PaymentStatus {
  CREATED = 'CREATED',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Entity({ name: 'payments' })
export class Payment extends BaseEntity {
  /**
   * Payment provider (Razorpay / Cash)
   */
  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  provider: PaymentProvider;

  /**
   * Razorpay Order ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  orderId: string | null;

  /**
   * Razorpay Payment ID
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentId: string | null;

  /**
   * Razorpay Signature
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  signature: string | null;

  /**
   * Amount in paise (INR)
   */
  @Column({ type: 'int' })
  amount: number;

  /**
   * Currency
   */
  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  /**
   * Payment status
   */
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.CREATED,
  })
  status: PaymentStatus;
}
