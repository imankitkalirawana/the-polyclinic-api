import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { VerificationType } from '../../entities/verification.entity';

/** Token is 64 hex chars (32 bytes). */
const TOKEN_LENGTH = 64;

export class VerifyTokenDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(TOKEN_LENGTH, TOKEN_LENGTH, {
    message: 'Verification token must be 64 hexadecimal characters',
  })
  @Matches(/^[a-fA-F0-9]+$/, {
    message: 'Verification token must be hexadecimal',
  })
  token: string;

  @IsEnum(VerificationType)
  @IsNotEmpty()
  type: VerificationType;
}
