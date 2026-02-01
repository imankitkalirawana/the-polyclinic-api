import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CompanyType } from '../../entities/company.entity';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  company_code: string;

  @IsEnum(CompanyType)
  company_type: CompanyType;

  /**
   * Optional default schema for this company (groups typically carry schemas).
   */
  @IsString()
  @IsOptional()
  schema?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  time_zone?: string;
}
