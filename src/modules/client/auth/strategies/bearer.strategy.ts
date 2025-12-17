import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
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

@Injectable()
export class BearerStrategy extends PassportStrategy(
  Strategy,
  'tenant-bearer',
) {
  constructor(private moduleRef: ModuleRef) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: any) {
    // Check if token has the required type field
    if (!payload.type || payload.type !== 'tenant') {
      throw new UnauthorizedException(
        'Invalid token type. This endpoint requires a tenant authentication token.',
      );
    }

    // Type assertion after validation
    const tenantPayload = payload as JwtPayload;

    // Get context ID from request and resolve CONNECTION
    const contextId = ContextIdFactory.getByRequest(request);
    // Make the current request available for request-scoped providers
    this.moduleRef.registerRequestByContextId(request, contextId);
    const connection = await this.moduleRef.resolve<DataSource | null>(
      CONNECTION,
      contextId,
      { strict: false },
    );

    if (!connection) {
      throw new UnauthorizedException('Tenant connection not available');
    }

    const tenantSlug = (request as any).tenantSlug;
    if (!tenantSlug) {
      throw new UnauthorizedException(
        'Tenant slug is required. Please include x-tenant-slug header.',
      );
    }

    if (tenantPayload.tenantSlug !== tenantSlug) {
      throw new UnauthorizedException('Tenant mismatch');
    }

    const sessionRepository = connection.getRepository(Session);
    const userRepository = connection.getRepository(TenantUser);

    const session = await sessionRepository.findOne({
      where: { id: tenantPayload.sessionId },
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
      where: { id: tenantPayload.userId },
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
