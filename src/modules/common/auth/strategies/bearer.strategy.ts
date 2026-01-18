import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Session } from '../entities/session.entity';
import { User } from '../../users/entities/user.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { UserTenant } from '../../users/entities/user-tenant.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from 'src/common/enums/role.enum';
import { JwtPayload } from '../auth.service';
import { getTenantConnection } from '../../../tenancy/connection-pool';
import { Doctor } from '../../../client/doctors/entities/doctor.entity';

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy, 'bearer') {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(UserTenant)
    private userTenantRepository: Repository<UserTenant>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    const session = await this.sessionRepository.findOne({
      where: { id: payload.sessionId },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (new Date() > session.expiresAt) {
      await this.sessionRepository.remove(session);
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // Get tenant context from request header
    const tenantSlug = (request as any).tenantSlug;

    // Verify user belongs to tenant if tenant context is provided
    if (tenantSlug) {
      const tenant = await this.tenantRepository.findOne({
        where: { slug: tenantSlug },
      });

      if (tenant) {
        const isMember = await this.userTenantRepository.exists({
          where: { userId: user.id, tenantId: tenant.id },
        });

        if (!isMember) {
          throw new UnauthorizedException(
            'User does not belong to this tenant',
          );
        }
      }
    }

    // Fetch patientId or doctorId based on user role
    let patientId: string | null = null;
    let doctorId: string | null = null;

    if (user.role === Role.PATIENT) {
      const patient = await this.patientRepository.findOne({
        where: { userId: user.id },
      });
      patientId = patient?.id || null;
    } else if (user.role === Role.DOCTOR && tenantSlug) {
      // Get doctor from tenant schema
      try {
        const connection = await getTenantConnection(tenantSlug);
        const doctorRepository = connection.getRepository(Doctor);
        const doctor = await doctorRepository.findOne({
          where: { userId: user.id },
        });
        doctorId = doctor?.id || null;
      } catch (error) {
        // Doctor not found in tenant schema is okay
      }
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
      tenantSlug: tenantSlug || null,
      name: user.name,
      phone: user.phone,
      patientId,
      doctorId,
    };
  }
}
