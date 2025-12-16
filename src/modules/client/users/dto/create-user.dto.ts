import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Role } from 'src/common/enums/role.enum';
import { Status } from 'src/common/enums/status.enum';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

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
