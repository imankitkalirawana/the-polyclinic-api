import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { Gender } from '@/common/patients/entities/patient.entity';
import { Transform } from 'class-transformer';

export class CreatePatientDto {
  @Transform(({ value }) => value.trim())
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(150)
  age?: number;

  @IsString()
  @IsOptional()
  dob?: string | Date;

  @IsString()
  @IsOptional()
  address?: string;
}
