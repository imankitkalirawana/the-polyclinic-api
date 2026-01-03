import { IsEnum, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';
import { PaymentReferenceType } from '../entities/payment.entity';

export enum Currency {
  INR = 'INR',
}

export class CreatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  referenceId: string;

  @IsNumber()
  @Min(100) // 100 paisa = 1 INR
  amount: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsEnum(PaymentReferenceType)
  @IsNotEmpty()
  referenceType: PaymentReferenceType;
}
