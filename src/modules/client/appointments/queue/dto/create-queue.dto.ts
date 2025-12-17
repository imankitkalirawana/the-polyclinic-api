import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateQueueDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  doctorId: string;
}
