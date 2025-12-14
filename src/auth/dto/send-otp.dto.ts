import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
