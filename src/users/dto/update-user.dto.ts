import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { Role } from 'generated/prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
