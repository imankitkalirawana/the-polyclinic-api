import { IsEmail, IsEnum } from 'class-validator';
import { OtpType } from '../entities/otp.entity';

export class RequestOtpDto {
  @IsEmail()
  email: string;

  @IsEnum(OtpType)
  type: OtpType;
}
