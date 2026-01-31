import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDoctorDto {
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

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  seating?: string;

  // Global profile fields (public.doctors)
  @IsInt()
  @Min(0)
  @IsOptional()
  experience?: number;

  @IsString()
  @IsOptional()
  education?: string;

  @IsString()
  @IsOptional()
  biography?: string;

  // Tenant membership fields (public.doctor_tenant_memberships)
  @IsArray()
  @IsOptional()
  departments?: string[];
}
