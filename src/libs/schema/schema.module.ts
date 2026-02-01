import { Global, Module } from '@nestjs/common';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { SCHEMA_KEY } from './schema.constants';
import { SchemaHandler } from './schema.service';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          const schema = req.headers['x-schema'];

          cls.set(SCHEMA_KEY, schema);
        },
      },
    }),
  ],
  providers: [SchemaHandler],
  exports: [ClsModule, SchemaHandler],
})
export class SchemaModule {}
