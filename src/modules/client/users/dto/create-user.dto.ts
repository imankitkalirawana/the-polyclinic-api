import { Gender } from '@/client/patients/entities/patient.entity';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  IsUUID,
  Validate,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Role } from 'src/common/enums/role.enum';
import { Status } from 'src/common/enums/status.enum';

// For patient
@ValidatorConstraint({ name: 'PatientNameEmailConstraint', async: false })
export class PatientNameEmailConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as CreateUserDto;

    if (!obj) return false;

    // Only apply this validation if role is PATIENT
    if (obj.role !== Role.PATIENT) return true;

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

// For doctor
@ValidatorConstraint({ name: 'DoctorNameEmailConstraint', async: false })
export class DoctorNameEmailConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as CreateUserDto;

    if (!obj) return false;

    // Only apply this validation if role is DOCTOR
    if (obj.role !== Role.DOCTOR) return true;

    // Case 1: userId provided → OK
    if (obj.userId) return true;

    // Case 2: email + phone + name
    if (obj.email && obj.phone && obj.name) return true;

    return false;
  }

  defaultMessage() {
    return 'Either userId must be provided, or email + phone + name';
  }
}

@ValidatorConstraint({ name: 'DefaultValidationCheck', async: false })
export class DefaultValidationCheck implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as CreateUserDto;

    if (!obj) return false;

    if (![Role.PATIENT, Role.DOCTOR].includes(obj.role)) {
      if (!obj.name || !obj.email || !obj.phone) return false;
      return true;
    }
    return true;
  }

  defaultMessage() {
    return 'Name, email, and phone are required';
  }
}

export class CreateUserDto {
  @Validate(DefaultValidationCheck)
  _defaultValidationCheck: boolean;

  @Validate(PatientNameEmailConstraint)
  _patientValidationCheck: boolean;

  @Validate(DoctorNameEmailConstraint)
  _doctorValidationCheck: boolean;

  @IsString()
  @IsOptional()
  name: string;

  @IsEmail()
  @IsOptional()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role: Role = Role.PATIENT;

  @IsEnum(Status)
  @IsOptional()
  status: Status = Status.ACTIVE;

  @IsString()
  @IsOptional()
  image?: string;

  @IsUUID()
  @IsOptional()
  userId: string;

  // Patient fields
  @IsNumber()
  @Min(0)
  @Max(120)
  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  age?: number;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  address?: string;

  // Doctor fields
  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departments?: string[];

  @IsString()
  @IsOptional()
  experience?: string;

  @IsString()
  @IsOptional()
  education?: string;

  @IsString()
  @IsOptional()
  biography?: string;

  @IsString()
  @IsOptional()
  seating?: string;
}
