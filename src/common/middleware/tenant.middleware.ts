import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const raw = req.headers['x-tenant'];

    if (raw === undefined) {
      return next();
    }

    if (Array.isArray(raw)) {
      throw new BadRequestException('Invalid x-tenant header');
    }

    const schema = String(raw).trim().toLowerCase();
    if (!schema) {
      throw new BadRequestException('x-tenant header is empty');
    }

    if (schema.length > 63) {
      throw new BadRequestException('x-tenant is too long');
    }

    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
      throw new BadRequestException('Invalid x-tenant format');
    }

    if (
      schema === 'public' ||
      schema === 'information_schema' ||
      schema === 'pg_catalog' ||
      schema === 'pg_toast'
    ) {
      throw new BadRequestException('x-tenant is reserved');
    }

    req.tenantSlug = schema;
    return next();
  }
}
