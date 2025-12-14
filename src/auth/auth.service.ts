import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from 'generated/prisma/client';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { SessionsService } from './sessions.service';
import { SessionResponse, SessionUser } from './dto/session.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
    private sessionsService: SessionsService,
  ) {}

  /**
   * Generate a random 6-digit OTP
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP to the provided email
   */
  async sendOtp(sendOtpDto: SendOtpDto): Promise<{ message: string }> {
    const { email } = sendOtpDto;

    // Generate OTP
    const otp = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

    // Invalidate any existing unverified OTPs for this email
    await this.prisma.otp.updateMany({
      where: {
        email,
        verified: false,
      },
      data: {
        verified: true, // Mark as used/invalid
      },
    });

    // Create new OTP record
    await this.prisma.otp.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });

    // TODO: Send OTP via email service (e.g., SendGrid, AWS SES, etc.)
    // For now, we'll just log it (remove in production)
    console.log(`OTP for ${email}: ${otp}`);

    return {
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(
    verifyOtpDto: VerifyOtpDto,
  ): Promise<{ message: string; verified: boolean }> {
    const { email, otp } = verifyOtpDto;

    // Find the most recent unverified OTP for this email
    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email,
        otp,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Mark OTP as verified
    await this.prisma.otp.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        verified: true,
      },
    });

    return {
      message: 'OTP verified successfully',
      verified: true,
    };
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ message: string; user: Omit<User, 'password'> }> {
    const { name, email, password } = registerDto;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      name,
      email,
      password: hashedPassword,
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; token: string; sessionId: string }> {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Calculate session expiration (default to 7 days, or use JWT expiration)
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const expiresAt = this.calculateExpirationDate(expiresIn);

    // Create session in database
    const session = await this.sessionsService.createSession(
      user.id,
      expiresAt,
      ipAddress,
      userAgent,
    );

    // Generate JWT token with sessionId included
    const token = await this.jwtService.signAsync({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      sessionId: session.sessionId,
    });

    return {
      message: 'Logged in successfully',
      token,
      sessionId: session.sessionId,
    };
  }

  /**
   * Logout the user by invalidating their session
   */
  async logout(sessionId: string): Promise<{ message: string }> {
    // Delete the session from the database
    await this.sessionsService.deleteSession(sessionId);

    return {
      message: 'Logged out successfully',
    };
  }

  /**
   * Get the current session information
   */
  async getCurrentSession(user: User): Promise<SessionResponse> {
    const sessionUser: SessionUser = {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      image: '',
      organization: null,
      phone: '',
    };

    return {
      user: sessionUser,
    };
  }

  /**
   * Calculate expiration date from a string like '7d', '24h', '30m'
   */
  private calculateExpirationDate(expiresIn: string): Date {
    const expiresAt = new Date();
    const match = expiresIn.match(/^(\d+)([dhms])$/);

    if (!match) {
      // Default to 7 days if format is invalid
      expiresAt.setDate(expiresAt.getDate() + 7);
      return expiresAt;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + value);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + value);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + value);
        break;
      case 's':
        expiresAt.setSeconds(expiresAt.getSeconds() + value);
        break;
      default:
        expiresAt.setDate(expiresAt.getDate() + 7);
    }

    return expiresAt;
  }
}
