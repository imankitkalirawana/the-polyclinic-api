import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { VerificationType } from '../../entities/verification.entity';

export class SendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(VerificationType)
  @IsNotEmpty()
  type: VerificationType;
}
