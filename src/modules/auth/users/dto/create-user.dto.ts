import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from 'src/common/enums/role.enum';
import { CompanyType } from '../../entities/company.entity';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsEnum(CompanyType)
  @IsOptional()
  company_type?: CompanyType;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  time_zone?: string;

  /**
   * Optional list of tenant schema slugs this user can access.
   * Values are normalized/validated server-side.
   */
  @IsArray()
  @IsOptional()
  companies?: string[];
}
