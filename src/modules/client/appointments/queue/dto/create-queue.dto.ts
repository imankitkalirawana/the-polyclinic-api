import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaymentMode } from '../enums/queue.enum';

export class CreateQueueDto {
  // Queue ID is optional, if provided, the queue will be updated
  @IsUUID()
  @IsOptional()
  queueId?: string;

  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode: PaymentMode;
}
