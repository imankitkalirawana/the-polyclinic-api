import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { Session } from './entities/session.entity';
import { Otp, OtpType } from './entities/otp.entity';
import { UserTenant } from '../users/entities/user-tenant.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Patient } from '../patients/entities/patient.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { Role } from 'src/common/enums/role.enum';

export interface JwtPayload {
  sessionId: string;
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(Otp)
    private otpRepository: Repository<Otp>,
    @InjectRepository(UserTenant)
    private userTenantRepository: Repository<UserTenant>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @Inject(REQUEST) private request: Request,
    private jwtService: JwtService,
  ) {}

  private getTenantSlug(): string | null {
    return (this.request as any).tenantSlug || null;
  }

  async requestOtp(requestOtpDto: RequestOtpDto): Promise<{ message: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: requestOtpDto.email },
    });

    if (requestOtpDto.type === OtpType.REGISTRATION) {
      if (existingUser) {
        throw new UnauthorizedException('User with this email already exists');
      }
    } else if (requestOtpDto.type === OtpType.FORGOT_PASSWORD) {
      if (!existingUser) {
        throw new UnauthorizedException('User with this email does not exist');
      }
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate any existing unverified OTPs for this email
    await this.otpRepository.update(
      {
        email: requestOtpDto.email,
        verified: false,
        type: requestOtpDto.type,
      },
      { verified: true },
    );

    // Create new OTP
    const otp = this.otpRepository.create({
      email: requestOtpDto.email,
      type: requestOtpDto.type,
      code,
      expiresAt,
      verified: false,
    });

    await this.otpRepository.save(otp);

    // TODO: Send OTP via email/SMS service
    this.logger.log(`OTP for ${requestOtpDto.email}: ${code}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const otp = await this.otpRepository.findOne({
      where: {
        email: verifyOtpDto.email,
        code: verifyOtpDto.code,
        verified: false,
        type: verifyOtpDto.type,
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
    await this.otpRepository.save(otp);

    return { message: 'OTP verified successfully' };
  }

  async checkEmail(checkEmailDto: CheckEmailDto): Promise<{ exists: boolean }> {
    const user = await this.userRepository.findOne({
      where: { email: checkEmailDto.email },
    });
    return { exists: !!user };
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    // Check if OTP is verified
    const verifiedOtp = await this.otpRepository.findOne({
      where: {
        email: registerDto.email,
        verified: true,
        type: OtpType.REGISTRATION,
      },
      order: { createdAt: 'DESC' },
    });

    if (!verifiedOtp) {
      throw new UnauthorizedException(
        'Please verify your email with OTP before registering',
      );
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
      withDeleted: true,
    });

    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      role: registerDto.role || Role.PATIENT,
    });

    const savedUser = await this.userRepository.save(user);

    // Add user to tenant if tenant context exists
    const tenantSlug = this.getTenantSlug();
    if (tenantSlug) {
      const tenant = await this.tenantRepository.findOne({
        where: { slug: tenantSlug },
      });
      if (tenant) {
        const userTenant = this.userTenantRepository.create({
          userId: savedUser.id,
          tenantId: tenant.id,
        });
        await this.userTenantRepository.save(userTenant);
      }
    }

    // Create patient record if role is PATIENT
    if (savedUser.role === Role.PATIENT) {
      const patient = this.patientRepository.create({
        userId: savedUser.id,
      });
      await this.patientRepository.save(patient);
    }

    // Create session
    const token = await this.createSession(savedUser);

    // Clean up verified OTP after successful registration
    await this.otpRepository.delete({
      email: registerDto.email,
      verified: true,
    });

    const { password: _, ...userWithoutPassword } = savedUser;
    return { user: userWithoutPassword, token };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      withDeleted: true,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user belongs to tenant (if tenant context exists)
    const tenantSlug = this.getTenantSlug();
    if (tenantSlug) {
      const tenant = await this.tenantRepository.findOne({
        where: { slug: tenantSlug },
      });
      if (tenant) {
        const isMember = await this.userTenantRepository.exists({
          where: { userId: user.id, tenantId: tenant.id },
        });
        if (!isMember) {
          // Auto-add user to tenant on first login
          const userTenant = this.userTenantRepository.create({
            userId: user.id,
            tenantId: tenant.id,
          });
          await this.userTenantRepository.save(userTenant);
        }
      }
    }

    this.logger.log(`User ${user.email} logged in`);

    // Create session
    const token = await this.createSession(user);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.delete({ id: sessionId });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const verifiedOtp = await this.otpRepository.findOne({
      where: {
        email: forgotPasswordDto.email,
        verified: true,
        type: OtpType.FORGOT_PASSWORD,
        expiresAt: MoreThanOrEqual(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!verifiedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('User with this email does not exist');
    }

    const hashedPassword = await bcrypt.hash(forgotPasswordDto.password, 10);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Clean up verified OTP
    await this.otpRepository.delete({
      email: forgotPasswordDto.email,
      verified: true,
    });
  }

  private async createSession(user: User): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const session = this.sessionRepository.create({
      userId: user.id,
      expiresAt,
      token: '', // Will be set after JWT generation
    });

    const savedSession = await this.sessionRepository.save(session);

    const payload: JwtPayload = {
      sessionId: savedSession.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    // Update session with token
    savedSession.token = token;
    await this.sessionRepository.save(savedSession);

    return token;
  }

  async getSession(userId: string): Promise<{
    user: Omit<User, 'password'> & {
      patientId?: string | null;
      tenants?: string[];
    };
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name', 'role', 'phone', 'image', 'status'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let patientId: string | null = null;
    if (user.role === Role.PATIENT) {
      const patient = await this.patientRepository.findOne({
        where: { userId: user.id },
      });
      patientId = patient?.id || null;
    }

    // Get user's tenants
    const userTenants = await this.userTenantRepository.find({
      where: { userId: user.id },
      relations: ['tenant'],
    });
    const tenants = userTenants.map((ut) => ut.tenant.slug);

    return {
      user: {
        ...user,
        patientId,
        tenants,
      },
    };
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }

  async cleanupExpiredOtps(): Promise<void> {
    await this.otpRepository
      .createQueryBuilder()
      .delete()
      .from(Otp)
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }
}
