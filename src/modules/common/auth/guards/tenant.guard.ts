import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTenant } from '../../users/entities/user-tenant.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Guard to ensure user belongs to the tenant specified in x-tenant-slug header
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @InjectRepository(UserTenant)
    private userTenantRepository: Repository<UserTenant>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const tenantSlug = request.tenantSlug;

    if (!tenantSlug) {
      // No tenant context required
      return true;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    const isMember = await this.userTenantRepository.exists({
      where: { userId: user.userId, tenantId: tenant.id },
    });

    if (!isMember) {
      throw new UnauthorizedException('User does not belong to this tenant');
    }

    return true;
  }
}
