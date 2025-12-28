import { Module, Scope, OnModuleDestroy } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { CONNECTION } from './tenancy.symbols';
import { getTenantConnection, closeAllConnections } from './connection-pool';
import { TenantMigrationService } from './services/tenant-migration.service';
import { TenantAuthInitService } from './tenant-auth-init.service';

const connectionFactory = {
  provide: CONNECTION,
  scope: Scope.REQUEST,
  useFactory: async (request: Request): Promise<DataSource | null> => {
    const tenantSlug = (request as any).tenantSlug;

    if (!tenantSlug) {
      return null;
    }

    return await getTenantConnection(tenantSlug);
  },
  inject: [REQUEST],
};

@Module({
  providers: [connectionFactory, TenantMigrationService, TenantAuthInitService],
  exports: [CONNECTION, TenantMigrationService, TenantAuthInitService],
})
export class TenancyModule implements OnModuleDestroy {
  async onModuleDestroy() {
    await closeAllConnections();
  }
}
