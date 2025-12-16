import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { SystemRole } from 'src/common/enums/role.enum';

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

  @IsEnum(SystemRole)
  @IsOptional()
  role?: SystemRole;
}

