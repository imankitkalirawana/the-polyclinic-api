import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { MoreThan } from 'typeorm';
import { Verification, VerificationType } from './entities/verification.entity';
import { Repository } from 'typeorm';
import { UsersService } from './users/users.service';

/** Length in bytes for the verification token (64 hex chars when encoded). */
const VERIFICATION_TOKEN_BYTES = 32;
/** OTP length in digits. */
const OTP_LENGTH = 6;
/** Verification validity window in milliseconds (10 minutes). */
const VERIFICATION_EXPIRY_MS = 10 * 60 * 1000;

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly usersService: UsersService,
  ) {}

  async sendOtp(email: string, type: VerificationType): Promise<void> {
    await this.validateTypeAndUser(email, type);
    await this.deletePreviousVerifications(email, type);

    const otp = this.generateVerificationOtp();
    const { raw: tokenRaw, hash: tokenHash } = this.generateVerificationToken();
    const expiryDate = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

    await this.verificationRepository.save({
      email,
      token: tokenHash,
      otp,
      expiry_date: expiryDate,
      type,
    });
    await this.sendVerificationEmail(email, otp, tokenRaw);
  }

  /**
   * Verifies an OTP for the given email and type.
   * Checks expiry and uses constant-time comparison. Consumes the verification on success.
   * Throws with a generic message on failure to avoid leaking whether email/OTP exists.
   */
  async verifyOtp({
    email,
    otp,
    type,
    withDeleted = false,
  }: {
    email: string;
    otp: string;
    type: VerificationType;
    withDeleted?: boolean;
  }) {
    await this.validateTypeAndUser(email, type);

    const verification = await this.verificationRepository.findOne({
      where: {
        email,
        otp,
        type,
        expiry_date: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
      withDeleted,
    });
    if (!verification) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (!this.timingSafeEqual(otp, verification.otp)) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.deleteVerification(verification.id);
    return verification;
  }

  //   verify and delete verification
  async reverifyOtp(
    email: string,
    otp: string,
    type: VerificationType,
  ): Promise<void> {
    const verification = await this.verifyOtp({
      email,
      otp,
      type,
      withDeleted: true,
    });
    await this.deleteVerification(verification.id);
  }

  //   delete all previous
  async deletePreviousVerifications(
    email: string,
    type: VerificationType,
  ): Promise<void> {
    console.log('deletePreviousVerifications', email, type);
    await this.verificationRepository.softDelete({
      email,
      type,
    });
  }

  /**
   * Verifies a verification token (e.g. from email link).
   * Validates expiry, uses constant-time comparison, and consumes the verification on success.
   * Throws with a generic message on failure to avoid leaking whether email/token exists.
   */
  async verifyToken(
    email: string,
    token: string,
    type: VerificationType,
  ): Promise<void> {
    if (token.length !== VERIFICATION_TOKEN_BYTES * 2) {
      throw new UnauthorizedException('Invalid or expired verification link');
    }
    if (!/^[a-f0-9]+$/i.test(token)) {
      throw new UnauthorizedException('Invalid or expired verification link');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');

    const verification = await this.verificationRepository.findOne({
      where: {
        email,
        type,
        expiry_date: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    if (!verification) {
      throw new UnauthorizedException('Invalid or expired verification link');
    }

    if (!this.timingSafeEqual(tokenHash, verification.token)) {
      throw new UnauthorizedException('Invalid or expired verification link');
    }

    await this.validateTypeAndUser(email, type);
    await this.deleteVerification(verification.id);
  }

  async deleteVerification(id: string): Promise<void> {
    await this.verificationRepository.softDelete(id);
  }

  private async sendVerificationEmail(
    _email: string,
    _otp: string,
    _token: string,
  ): Promise<void> {
    // await this.emailService.sendEmail(email, 'Verification Email');
    // TODO: Send verification email with otp and token (token for link, otp for manual entry)
  }

  /** Generates a cryptographically secure 6-digit OTP. */
  private generateVerificationOtp(): string {
    const bytes = crypto.randomBytes(4);
    const value = bytes.readUInt32BE(0) % 1_000_000;
    return value.toString().padStart(OTP_LENGTH, '0');
  }

  /**
   * Generates a cryptographically random token and returns both the raw token
   * (to send to the user) and its SHA-256 hash (to store in the DB).
   */
  private generateVerificationToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString('hex');
    const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    return { raw, hash };
  }

  /**
   * Constant-time comparison to prevent timing attacks.
   * Both buffers must be the same length.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    if (bufA.length === 0) {
      return true;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Validates that the email is allowed for the given verification type:
   * - REGISTRATION: user must NOT exist (email not yet registered).
   * - LOGIN / PASSWORD_RESET: user must exist.
   */
  private async validateTypeAndUser(
    email: string,
    type: VerificationType,
  ): Promise<void> {
    const user = await this.usersService.checkUserExistsByEmail(email);

    switch (type) {
      case VerificationType.REGISTRATION:
        if (user) {
          throw new ConflictException('Email already registered');
        }
        break;
      case VerificationType.LOGIN:
      case VerificationType.PASSWORD_RESET:
        if (!user) {
          throw new UnauthorizedException(
            'Invalid or expired verification code',
          );
        }
        break;
    }
  }
}
