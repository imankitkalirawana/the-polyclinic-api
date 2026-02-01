import { IsBoolean } from 'class-validator';

export class UpdateSharingDto {
  @IsBoolean()
  shareMedicalHistory: boolean;
}

