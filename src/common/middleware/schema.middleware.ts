import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { SchemaHandler } from 'src/libs/schema/schema.service';

/**
 * Parses and validates x-schema header for unauthenticated flows (e.g. register).
 * For authenticated routes, schema is set from the JWT in the bearer strategy and
 * x-schema is ignored for authorization (prevents cross-tenant access).
 */
@Injectable()
export class SchemaMiddleware implements NestMiddleware {
  constructor(
    private readonly cls: ClsService,
    private readonly schemaHandler: SchemaHandler,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    this.cls.run(() => {
      const raw = req.headers['x-schema'];

      if (raw === undefined) {
        return next();
      }

      if (Array.isArray(raw)) {
        throw new BadRequestException('Invalid x-schema header');
      }

      const schema = String(raw).trim().toLowerCase();
      if (!schema) {
        throw new BadRequestException('x-schema header is empty');
      }

      if (schema.length > 63) {
        throw new BadRequestException('x-schema is too long');
      }

      if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
        throw new BadRequestException('Invalid x-schema format');
      }

      if (
        schema === 'public' ||
        schema === 'information_schema' ||
        schema === 'pg_catalog' ||
        schema === 'pg_toast'
      ) {
        throw new BadRequestException('x-schema is reserved');
      }

      req.schema = schema;
      this.schemaHandler.set(schema);
      return next();
    });
  }
}
