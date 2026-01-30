import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { SCHEMA_KEY } from './schema.constants';
import { SchemaValidatorService } from '@/auth/schema/schema-validator.service';

@Injectable()
export class SchemaHandler {
  constructor(
    private readonly cls: ClsService,
    private readonly schemaValidator: SchemaValidatorService,
  ) {}

  async current() {
    const schema = this.cls.get(SCHEMA_KEY);

    // if schema is there then also validate if it exists in the database
    if (schema) {
      const schemaExists = await this.schemaValidator.schemaExists(schema);
      if (!schemaExists) {
        throw new NotFoundException('Schema not found');
      }
    }

    return schema;
  }

  set(schema: string): void {
    this.cls.set(SCHEMA_KEY, schema);
  }

  clear(): void {
    this.cls.set(SCHEMA_KEY, undefined);
  }
}
