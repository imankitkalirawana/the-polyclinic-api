import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { SCHEMA_KEY } from './schema.constants';

@Injectable()
export class SchemaHandler {
  constructor(private readonly cls: ClsService) {}

  current(): string | undefined {
    return this.cls.get(SCHEMA_KEY);
  }

  set(schema: string): void {
    this.cls.set(SCHEMA_KEY, schema);
  }

  clear(): void {
    this.cls.set(SCHEMA_KEY, undefined);
  }
}
