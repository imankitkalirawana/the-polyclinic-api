import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PublicUser } from './entities/public-user.entity';
import { Session } from './entities/session.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../../../common/enums/role.enum';
import { JwtPayload } from './strategies/bearer.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(PublicUser, 'default')
    private userRepository: Repository<PublicUser>,
    @InjectRepository(Session, 'default')
    private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: PublicUser; token: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      role: registerDto.role || Role.OPS,
    });

    const savedUser = await this.userRepository.save(user);

    // Create session
    const token = await this.createSession(savedUser);

    return { user: savedUser, token };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: PublicUser; token: string }> {
    const user = await this.userRepository.findOne({
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

    // Create session
    const token = await this.createSession(user);

    return { user, token };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.delete({ id: sessionId });
  }

  private async createSession(user: PublicUser): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const session = this.sessionRepository.create({
      user,
      expiresAt,
      token: '', // Will be set after JWT generation
    });

    const savedSession = await this.sessionRepository.save(session);

    const payload: JwtPayload = {
      sessionId: savedSession.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'public',
    };

    const token = this.jwtService.sign(payload);

    // Update session with token
    savedSession.token = token;
    await this.sessionRepository.save(savedSession);

    return token;
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }
}
