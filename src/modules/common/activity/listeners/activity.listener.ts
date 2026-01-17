import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { getTenantConnection } from '@/tenancy/connection-pool';
import { TenantMigrationService } from '@/tenancy/services/tenant-migration.service';
import { ActivityLog } from '../entities/activity-log.entity';
import { ActivityLogPayload } from '../interfaces/activity-payload.interface';
import { EntityType } from '../enums/entity-type.enum';
import { TenantUser } from '@/client/users/entities/tenant-user.entity';

@Injectable()
export class ActivityListener {
  private readonly logger = new Logger(ActivityListener.name);
  private static readonly CIRCULAR_LOG_PREVENTION_ENTITY =
    EntityType.ACTIVITY_LOG;

  constructor(
    private readonly tenantMigrationService: TenantMigrationService,
  ) {}

  @OnEvent('activity.log')
  async handleActivityLog(payload: ActivityLogPayload): Promise<void> {
    try {
      if (this.isCircularLogging(payload)) {
        this.logger.warn(
          'Circular logging detected, skipping activity log',
          payload,
        );
        return;
      }

      if (!this.hasChangedFields(payload)) {
        this.logger.debug('No fields changed, skipping activity log', payload);
        return;
      }

      if (!payload.tenantSlug) {
        this.logger.warn(
          'Tenant slug not available, skipping activity log',
          payload,
        );
        return;
      }

      const connection = await getTenantConnection(payload.tenantSlug);
      await this.tenantMigrationService.runMigrations(payload.tenantSlug);

      const repository: Repository<ActivityLog> =
        connection.getRepository(ActivityLog);
      const userRepository = connection.getRepository(TenantUser);

      let actor = null;
      if (payload.actorId && payload.actorType === 'USER') {
        actor = await userRepository.findOne({
          where: { id: payload.actorId },
        });
      }

      const activityLog = repository.create({
        entityType: payload.entityType,
        entityId: payload.entityId,
        module: payload.module,
        action: payload.action,
        changedFields: payload.changedFields || null,
        previousData: payload.previousData || null,
        newData: payload.newData || null,
        actorType: payload.actorType,
        actorId: payload.actorId || null,
        actor: actor,
        actorRole: payload.actorRole || null,
        description: payload.description || null,
        stakeholders: payload.stakeholders || [],
      });

      await repository.save(activityLog);
    } catch (error) {
      this.logger.error('Failed to persist activity log', error, payload);
    }
  }

  private isCircularLogging(payload: ActivityLogPayload): boolean {
    return (
      payload.entityType === ActivityListener.CIRCULAR_LOG_PREVENTION_ENTITY ||
      payload.module === 'activity'
    );
  }

  private hasChangedFields(payload: ActivityLogPayload): boolean {
    const action = payload.action;

    if (action === 'CREATED') {
      return !!payload.newData;
    }

    if (action === 'DELETED' || action === 'SOFT_DELETED') {
      return !!payload.previousData;
    }

    if (action === 'UPDATED' || action === 'STATUS_CHANGED') {
      if (!payload.changedFields) {
        return false;
      }
      const changedFieldsKeys = Object.keys(payload.changedFields);
      return changedFieldsKeys.length > 0;
    }

    return false;
  }
}
