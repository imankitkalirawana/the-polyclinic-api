import { Injectable, UnauthorizedException, Scope } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { CONNECTION } from '../../../tenancy/tenancy.symbols';
import { Session } from '../entities/session.entity';
import { TenantUser } from '../entities/tenant-user.entity';

export interface JwtPayload {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
  type: 'tenant';
  tenantSlug: string;
}

@Injectable({ scope: Scope.REQUEST })
export class BearerStrategy extends PassportStrategy(
  Strategy,
  'tenant-bearer',
) {
  constructor(
    @Inject(REQUEST) private request: Request,
    @Inject(CONNECTION) private connection: DataSource | null,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        '8f2b5e4317f4e50d25df2d9bfe536d58a7dd7912fbdc6fb8fb32bdc19f3bbe4e',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'tenant') {
      throw new UnauthorizedException('Invalid token type');
    }

    if (!this.connection) {
      throw new UnauthorizedException('Tenant connection not available');
    }

    const tenantSlug = (this.request as any).tenantSlug;
    if (payload.tenantSlug !== tenantSlug) {
      throw new UnauthorizedException('Tenant mismatch');
    }

    const sessionRepository = this.connection.getRepository(Session);
    const userRepository = this.connection.getRepository(TenantUser);

    const session = await sessionRepository.findOne({
      where: { id: payload.sessionId },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (new Date() > session.expiresAt) {
      // Delete expired session
      await sessionRepository.remove(session);
      throw new UnauthorizedException('Session expired');
    }

    const user = await userRepository.findOne({
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
      type: 'tenant',
      tenantSlug,
    };
  }
}
