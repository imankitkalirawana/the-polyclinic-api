import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { TenantUser } from './entities/tenant-user.entity';
import { Session } from './entities/session.entity';
import { Otp } from './entities/otp.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtPayload } from './strategies/bearer.strategy';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { CheckEmailDto } from './dto/check-email.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private initializedTenants = new Set<string>();

  constructor(
    @Inject(REQUEST) private request: Request,
    @Inject(CONNECTION) private connection: DataSource | null,
    private jwtService: JwtService,
    private tenantAuthInitService: TenantAuthInitService,
  ) {}

  private getTenantSlug(): string {
    const tenantSlug = (this.request as any).tenantSlug;
    if (!tenantSlug) {
      throw new UnauthorizedException('Tenant slug is required');
    }
    return tenantSlug;
  }

  /**
   * Ensure auth tables exist for the current tenant
   * This is a fallback for existing tenants that might not have tables yet
   */
  private async ensureTablesExist(): Promise<void> {
    const tenantSlug = this.getTenantSlug();

    // Skip if we've already initialized this tenant in this request
    if (this.initializedTenants.has(tenantSlug)) {
      return;
    }

    try {
      await this.tenantAuthInitService.ensureTenantAuthTables(tenantSlug);
      this.initializedTenants.add(tenantSlug);
    } catch (error) {
      this.logger.error(
        `Failed to ensure tables for tenant ${tenantSlug}:`,
        error,
      );
      // Don't throw - let the actual query fail with a more specific error
    }
  }

  private getUserRepository(): Repository<TenantUser> {
    if (!this.connection) {
      throw new UnauthorizedException('Tenant connection not available');
    }
    return this.connection.getRepository(TenantUser);
  }

  private getSessionRepository(): Repository<Session> {
    if (!this.connection) {
      throw new UnauthorizedException('Tenant connection not available');
    }
    return this.connection.getRepository(Session);
  }

  private getOtpRepository(): Repository<Otp> {
    if (!this.connection) {
      throw new UnauthorizedException('Tenant connection not available');
    }
    return this.connection.getRepository(Otp);
  }

  async requestOtp(requestOtpDto: RequestOtpDto) {
    await this.ensureTablesExist();
    const otpRepository = this.getOtpRepository();
    const userRepository = this.getUserRepository();

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: { email: requestOtpDto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate any existing unverified OTPs for this email
    await otpRepository.update(
      { email: requestOtpDto.email, verified: false },
      { verified: true }, // Mark as used/invalid
    );

    // Create new OTP
    const otp = otpRepository.create({
      email: requestOtpDto.email,
      code,
      expiresAt,
      verified: false,
    });

    await otpRepository.save(otp);

    // TODO: Send OTP via email/SMS service
    // For now, we'll log it (remove in production)
    this.logger.log(`OTP for ${requestOtpDto.email}`);
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    await this.ensureTablesExist();
    const otpRepository = this.getOtpRepository();

    const otp = await otpRepository.findOne({
      where: {
        email: verifyOtpDto.email,
        code: verifyOtpDto.code,
        verified: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    if (new Date() > otp.expiresAt) {
      throw new UnauthorizedException('OTP has expired');
    }

    // Mark OTP as verified
    otp.verified = true;
    await otpRepository.save(otp);
  }

  async checkEmail(checkEmailDto: CheckEmailDto) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({
      where: { email: checkEmailDto.email },
    });
    return !!user;
  }
  async register(registerDto: RegisterDto) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const otpRepository = this.getOtpRepository();

    // Check if OTP is verified
    const verifiedOtp = await otpRepository.findOne({
      where: {
        email: registerDto.email,
        verified: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!verifiedOtp) {
      throw new UnauthorizedException(
        'Please verify your email with OTP before registering',
      );
    }

    // Check if OTP was verified recently (within last 30 minutes)
    const otpAge = Date.now() - verifiedOtp.createdAt.getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    if (otpAge > thirtyMinutes) {
      throw new UnauthorizedException(
        'OTP verification has expired. Please request a new OTP',
      );
    }

    const existingUser = await userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      role: registerDto.role,
    });

    const savedUser = await userRepository.save(user);

    // Create session
    const token = await this.createSession(savedUser);

    // Clean up verified OTP after successful registration
    await otpRepository.delete({ email: registerDto.email, verified: true });

    return { user: savedUser, token };
  }

  async login(loginDto: LoginDto) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User ${user.email} logged in`);

    // Create session
    const token = await this.createSession(user);

    this.logger.debug(
      `User ${user.email} logged in successfully, token: ${token}`,
    );

    return { token };
  }

  async logout(sessionId: string) {
    const sessionRepository = this.getSessionRepository();
    await sessionRepository.delete({ id: sessionId });
  }

  private async createSession(user: TenantUser) {
    const sessionRepository = this.getSessionRepository();
    const tenantSlug = this.getTenantSlug();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const session = sessionRepository.create({
      user,
      expiresAt,
      token: '', // Will be set after JWT generation
    });

    const savedSession = await sessionRepository.save(session);

    const payload: JwtPayload = {
      sessionId: savedSession.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'tenant',
      tenantSlug,
    };

    const token = this.jwtService.sign(payload);

    // Update session with token
    savedSession.token = token;
    await sessionRepository.save(savedSession);

    return token;
  }

  async cleanupExpiredSessions() {
    const sessionRepository = this.getSessionRepository();
    await sessionRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }

  async getSession(userId: string) {
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name', 'role', 'phone'],
    });

    return user;
  }
}
