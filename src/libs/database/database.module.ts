import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SchemaModule } from 'src/libs/schema/schema.module';
import { DatabaseService } from './database.service';
import { DataSourceConfig } from './datasource.config';
import { TenantConnectionLifecycleService } from './tenant-connection-lifecycle.service';

@Module({
  imports: [SchemaModule, ConfigModule.forFeature(DataSourceConfig)],
  providers: [DatabaseService, TenantConnectionLifecycleService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
