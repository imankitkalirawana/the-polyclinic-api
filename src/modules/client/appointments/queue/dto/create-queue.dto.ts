import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode: PaymentMode;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  appointmentDate: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}
