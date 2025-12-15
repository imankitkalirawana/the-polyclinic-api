import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request type
interface TenantRequest extends Request {
  tenantSlug?: string;
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: TenantRequest, res: Response, next: NextFunction) {
    const tenantSlug = req.headers['x-tenant-slug'] as string;

    if (!tenantSlug) {
      // Allow requests without tenant slug for public routes (like creating tenants)
      // You might want to make this stricter based on your route structure
      return next();
    }

    if (typeof tenantSlug !== 'string' || tenantSlug.trim() === '') {
      throw new BadRequestException('Invalid tenant slug');
    }

    req.tenantSlug = tenantSlug.trim();
    next();
  }
}
