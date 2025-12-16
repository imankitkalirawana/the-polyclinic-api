import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';
import { Status } from 'src/common/enums/status.enum';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  image?: string;
}

