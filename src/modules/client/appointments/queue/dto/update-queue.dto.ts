import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateQueueDto } from './create-queue.dto';

export class UpdateQueueDto extends PartialType(
  OmitType(CreateQueueDto, ['patientId']),
) {}
