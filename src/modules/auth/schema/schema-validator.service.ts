import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type CacheEntry = {
  allowed: boolean;
  expiresAtMs: number;
};

@Injectable()
export class SchemaValidatorService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Validates the schema name and ensures it exists in Postgres.
   * - safe identifier (prevents SQL injection / reserved schemas)
   * - exists in Postgres
   */
  async assertSchemaExists(rawSchema: string): Promise<string> {
    const schema = this.normalizeAndValidateSchemaName(rawSchema).toLowerCase();

    const cached = this.cache.get(schema);
    if (cached && cached.expiresAtMs > Date.now()) {
      if (!cached.allowed)
        throw new BadRequestException('Schema does not exist');
      return schema;
    }

    const allowed = await this.schemaExists(schema);
    this.cache.set(schema, { allowed, expiresAtMs: Date.now() + this.ttlMs });

    if (!allowed) {
      throw new BadRequestException('Schema does not exist');
    }

    return schema;
  }

  normalizeAndValidateSchemaName(rawSchema: string): string {
    if (typeof rawSchema !== 'string') {
      throw new BadRequestException('Schema name must be a string');
    }

    const schema = rawSchema.trim();
    if (!schema) {
      throw new BadRequestException('Schema name is required');
    }

    // Postgres identifier max length is 63.
    if (schema.length > 63) {
      throw new BadRequestException('Schema name is too long');
    }

    // Tight identifier validation: letters/underscore first, then alnum/underscore.
    // This prevents quoting tricks and matches production-safe schema naming.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      throw new BadRequestException('Invalid schema name format');
    }

    const lowered = schema.toLowerCase();
    if (
      lowered === 'public' ||
      lowered === 'information_schema' ||
      lowered === 'pg_catalog' ||
      lowered === 'pg_toast'
    ) {
      throw new BadRequestException('Schema name is reserved');
    }

    return schema;
  }

  async schemaExists(schema: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `
      SELECT EXISTS(
        SELECT 1
        FROM information_schema.schemata
        WHERE schema_name = $1
      ) AS "exists";
    `,
      [schema],
    );

    return !!result?.[0]?.exists;
  }
}
