import { Module } from '@nestjs/common';
import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

import { SCHEMA_KEY } from './schema.constants';

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
  exports: [ClsModule],
})
export class SchemaModule {}
