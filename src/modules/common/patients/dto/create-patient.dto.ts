import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsEmail,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  ValidationArguments,
} from 'class-validator';
import { Gender } from '../entities/patient.entity';
import { Transform } from 'class-transformer';

@ValidatorConstraint({ name: 'PatientNameEmailConstraint', async: false })
export class PatientNameEmailConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as CreatePatientDto;

    if (!obj) return false;

    // Case 1: userId provided → OK
    if (obj.userId) return true;

    // Case 2: name + email
    if (obj.name && obj.email) return true;

    // Case 3: name + phone
    if (obj.name && obj.phone) return true;

    return false;
  }

  defaultMessage() {
    return 'Either userId must be provided, or name with email, or name with phone';
  }
}

export class CreatePatientDto {
  @Validate(PatientNameEmailConstraint)
  _validationCheck: boolean;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  image?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(150)
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  age?: number;

  @IsString()
  @IsOptional()
  address?: string;
}
