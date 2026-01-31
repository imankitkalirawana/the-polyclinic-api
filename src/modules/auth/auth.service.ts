import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { UsersService } from './users/users.service';

type GlobalToken = { token: string; expiresIn: string; schema: string };

@Injectable()
export class AuthService {
  private readonly schema: string;
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @Inject(REQUEST) private request: Request,
  ) {
    this.schema = this.request.schema;
  }

  async login(dto: LoginDto): Promise<GlobalToken> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.checkUserExistsByEmailAndFail(email);

    const ok = await bcrypt.compare(dto.password, user.password_digest);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { token, expiresAt } = await this.createSessionAndToken({
      user,
    });

    return {
      token,
      expiresIn: this.formatExpiresIn(expiresAt),
      schema: this.schema,
    };
  }

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    const { token, expiresAt } = await this.createSessionAndToken({
      user,
    });

    return {
      token,
      expiresIn: this.formatExpiresIn(expiresAt),
      schema: this.schema,
    };
  }

  // method to check if user is current user
  async isCurrentUser(userId: string): Promise<boolean> {
    const user = await this.usersService.findOne(userId);

    const isCurrentUser = user?.id === this.request.user.userId;
    if (!isCurrentUser) {
      throw new UnauthorizedException('Unauthorized');
    }
    return isCurrentUser;
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    const user = await this.usersService.checkUserExistsByEmail(email);
    return { exists: !!user };
  }

  async getSession(): Promise<{
    user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'phone' | 'companies'>;
  }> {
    const user = await this.usersService.findOne(this.request.user.userId);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        companies: user.companies,
      },
    };
  }

  async getSessions(): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { user_id: this.request.user.userId },
      select: ['id', 'createdAt', 'expires_at', 'ip', 'user_agent', 'user_id'],
    });
  }

  async logout(): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: this.request.user.sessionId },
    });
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    await this.sessionRepository.softDelete(session.id);
  }

  // logout all sessions for the current user
  async logoutAllSessions(): Promise<void> {
    await this.sessionRepository.softDelete({
      user_id: this.request.user.userId,
      id: Not(this.request.user.sessionId),
    });
  }

  private async createSessionAndToken(args: {
    user: User;
  }): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const basePayload: any = {
      sessionId: '',
      userId: args.user.id,
      email: args.user.email,
      role: args.user.role,
      schema: this.schema,
    };

    // Create session row first (digest computed after sign)
    const session: Session = this.sessionRepository.create({
      user_id: args.user.id,
      auth_token_digest: '',
      expires_at: expiresAt,
      ip: this.request.ip,
      user_agent: this.request.headers['user-agent'],
    });

    const saved = await this.sessionRepository.save(session);

    basePayload.sessionId = saved.id;

    const token = this.jwtService.sign(basePayload, { expiresIn: '7d' });
    const digest = createHash('sha256').update(token).digest('hex');

    saved.auth_token_digest = digest;
    await this.sessionRepository.save(saved);

    return { token, expiresAt };
  }

  private formatExpiresIn(expiresAt: Date): string {
    const seconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    return `${seconds}s`;
  }
}
