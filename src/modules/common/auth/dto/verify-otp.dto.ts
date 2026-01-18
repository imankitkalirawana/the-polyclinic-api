import { IsEmail, IsEnum, IsString, Length } from 'class-validator';
import { OtpType } from '../entities/otp.entity';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  code: string;

  @IsEnum(OtpType)
  type: OtpType;
}
