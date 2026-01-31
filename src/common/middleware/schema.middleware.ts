import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';

/**
 * Parses and validates Schema header for unauthenticated flows (e.g. register).
 * For authenticated routes, schema is set from the JWT in the bearer strategy and
 * Schema header is ignored for authorization (prevents cross-tenant access).
 */
@Injectable()
export class SchemaMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    this.cls.run(() => {
      const raw = req.header('Schema');

      if (raw === undefined) {
        return next();
      }

      if (Array.isArray(raw)) {
        throw new BadRequestException('Invalid Schema header');
      }

      const schema = String(raw).trim().toLowerCase();
      if (!schema) {
        throw new BadRequestException('Schema header is empty');
      }

      if (schema.length > 63) {
        throw new BadRequestException('Schema is too long');
      }

      if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
        throw new BadRequestException('Invalid Schema format');
      }

      if (
        schema === 'public' ||
        schema === 'information_schema' ||
        schema === 'pg_catalog' ||
        schema === 'pg_toast'
      ) {
        throw new BadRequestException('Schema is reserved');
      }

      req.schema = schema;
      return next();
    });
  }
}
