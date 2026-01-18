import { Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { DataSource, Repository, In } from 'typeorm';
import { BaseTenantService } from '@/tenancy/base-tenant.service';
import { CONNECTION } from '@/tenancy/tenancy.symbols';
import { TenantAuthInitService } from '@/tenancy/tenant-auth-init.service';
import { ActivityLog } from '../entities/activity-log.entity';
import { EntityType } from '../enums/entity-type.enum';
import { User } from '../../users/entities/user.entity';
import { getTenantConnection } from '@/tenancy/connection-pool';

@Injectable()
export class ActivityLogService extends BaseTenantService {
  constructor(
    @Inject(REQUEST) request: Request,
    @Inject(CONNECTION) connection: DataSource | null,
    tenantAuthInitService: TenantAuthInitService,
    @InjectRepository(User)
    private readonly publicUserRepository: Repository<User>,
  ) {
    super(request, connection, tenantAuthInitService, ActivityLogService.name);
  }

  async getActivityLogsByEntity(entityType: EntityType, entityId: string) {
    await this.ensureTablesExist();

    const tenantSlug = this.getTenantSlug();
    const connection = await getTenantConnection(tenantSlug);
    const repository: Repository<ActivityLog> =
      connection.getRepository(ActivityLog);

    const activityLogs = await repository.find({
      where: {
        entityType,
        entityId,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    // Get all unique stakeholder IDs and actor IDs
    const userIds = [
      ...new Set([
        ...activityLogs
          .flatMap((log) => log.stakeholders || [])
          .filter((id): id is string => !!id),
        ...activityLogs
          .map((log) => log.actorId)
          .filter((id): id is string => !!id),
      ]),
    ];

    // Fetch all users from public schema in one query
    const usersMap = new Map<string, User>();
    if (userIds.length > 0) {
      const users = await this.publicUserRepository.find({
        where: { id: In(userIds) },
      });
      users.forEach((user) => {
        usersMap.set(user.id, user);
      });
    }

    return activityLogs.map((log) => {
      const actor = log.actorId ? usersMap.get(log.actorId) : null;
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        module: log.module,
        action: log.action,
        changedFields: log.changedFields,
        previousData: log.previousData,
        newData: log.newData,
        description: log.description,
        createdAt: log.createdAt,
        stakeholders: log.stakeholders
          ? log.stakeholders
              .map((stakeholderId) => {
                const user = usersMap.get(stakeholderId);
                return user
                  ? {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      phone: user.phone,
                      image: user.image,
                      role: user.role,
                    }
                  : null;
              })
              .filter(
                (stakeholder): stakeholder is NonNullable<typeof stakeholder> =>
                  stakeholder !== null,
              )
          : [],
        actor: actor
          ? {
              id: actor.id,
              name: actor.name,
              email: actor.email,
              image: actor.image,
              role: actor.role,
              type: log.actorType,
            }
          : null,
      };
    });
  }

  async getActivityLogsByStakeholder(userId?: string) {
    await this.ensureTablesExist();

    const currentUserId = userId || (this.request as any)?.user?.userId;

    if (!currentUserId) {
      return [];
    }

    const tenantSlug = this.getTenantSlug();
    const connection = await getTenantConnection(tenantSlug);
    const repository: Repository<ActivityLog> =
      connection.getRepository(ActivityLog);

    // Use query builder for JSONB array containment query (@> operator)
    const activityLogs = await repository
      .createQueryBuilder('activityLog')
      .where('activityLog.stakeholders @> :userId', {
        userId: JSON.stringify([currentUserId]),
      })
      .orderBy('activityLog.createdAt', 'DESC')
      .getMany();

    // Get all unique user IDs (stakeholders and actors)
    const userIds = [
      ...new Set([
        ...activityLogs
          .flatMap((log) => log.stakeholders || [])
          .filter((id): id is string => !!id),
        ...activityLogs
          .map((log) => log.actorId)
          .filter((id): id is string => !!id),
      ]),
    ];

    // Fetch all users from public schema in one query
    const usersMap = new Map<string, User>();
    if (userIds.length > 0) {
      const users = await this.publicUserRepository.find({
        where: { id: In(userIds) },
      });
      users.forEach((user) => {
        usersMap.set(user.id, user);
      });
    }

    return activityLogs.map((log) => {
      const actor = log.actorId ? usersMap.get(log.actorId) : null;
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        module: log.module,
        action: log.action,
        changedFields: log.changedFields,
        previousData: log.previousData,
        newData: log.newData,
        description: log.description,
        createdAt: log.createdAt,
        stakeholders: log.stakeholders
          ? log.stakeholders
              .map((stakeholderId) => {
                const user = usersMap.get(stakeholderId);
                return user
                  ? {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      phone: user.phone,
                      image: user.image,
                      role: user.role,
                    }
                  : null;
              })
              .filter(
                (stakeholder): stakeholder is NonNullable<typeof stakeholder> =>
                  stakeholder !== null,
              )
          : [],
        actor: actor
          ? {
              id: actor.id,
              name: actor.name,
              email: actor.email,
              image: actor.image,
              role: actor.role,
              type: log.actorType,
            }
          : null,
      };
    });
  }
}
