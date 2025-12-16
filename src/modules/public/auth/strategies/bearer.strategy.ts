import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { PublicUser } from '../entities/public-user.entity';

export interface JwtPayload {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
  type: 'public';
}

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(
    @InjectRepository(Session, 'default')
    private sessionRepository: Repository<Session>,
    @InjectRepository(PublicUser, 'default')
    private userRepository: Repository<PublicUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        '8f2b5e4317f4e50d25df2d9bfe536d58a7dd7912fbdc6fb8fb32bdc19f3bbe4e',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'public') {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: payload.sessionId },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (new Date() > session.expiresAt) {
      // Delete expired session
      await this.sessionRepository.remove(session);
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
      type: 'public',
    };
  }
}
