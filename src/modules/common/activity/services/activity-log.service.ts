import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Repository, In } from 'typeorm';
import { ActivityLog } from '../entities/activity-log.entity';
import { EntityType } from '../enums/entity-type.enum';
import { User } from '@/auth/entities/user.entity';
import { getTenantConnection } from 'src/common/db/tenant-connection';

@Injectable()
export class ActivityLogService {
  constructor(@Inject(REQUEST) request: Request) {
    this.request = request;
  }

  private readonly request: Request;

  private getTenantSlug(): string {
    const tenantSlug = this.request?.tenantSlug;
    if (!tenantSlug) {
      throw new UnauthorizedException('Tenant schema is required');
    }
    return tenantSlug;
  }

  async getActivityLogsByEntity(entityType: EntityType, entityId: string) {
    const tenantSlug = this.getTenantSlug();
    const connection = await getTenantConnection(tenantSlug);
    const repository: Repository<ActivityLog> =
      connection.getRepository(ActivityLog);
    const userRepository: Repository<User> = connection.getRepository(User);

    const activityLogs = await repository.find({
      where: {
        entityType,
        entityId,
      },
      relations: ['actor'],
      order: {
        createdAt: 'DESC',
      },
    });

    // Get all unique stakeholder IDs
    const stakeholderIds = [
      ...new Set(
        activityLogs
          .flatMap((log) => log.stakeholders || [])
          .filter((id): id is string => !!id),
      ),
    ];

    // Fetch all stakeholders in one query
    const stakeholdersMap = new Map<string, User>();
    if (stakeholderIds.length > 0) {
      const stakeholders = await userRepository.find({
        where: { id: In(stakeholderIds) },
      });
      stakeholders.forEach((user) => {
        stakeholdersMap.set(user.id, user);
      });
    }

    return activityLogs.map((log) => ({
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
              const user = stakeholdersMap.get(stakeholderId);
              return user
                ? {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                  }
                : null;
            })
            .filter(
              (stakeholder): stakeholder is NonNullable<typeof stakeholder> =>
                stakeholder !== null,
            )
        : [],
      actor: log.actor
        ? {
            id: log.actor.id,
            name: log.actor.name,
            email: log.actor.email,
            role: log.actor.role,
            type: log.actorType,
          }
        : null,
    }));
  }

  async getActivityLogsByStakeholder(userId?: string) {
    const currentUserId = userId || this.request?.user?.userId;

    if (!currentUserId) {
      return [];
    }

    const tenantSlug = this.getTenantSlug();
    const connection = await getTenantConnection(tenantSlug);
    const repository: Repository<ActivityLog> =
      connection.getRepository(ActivityLog);
    const userRepository: Repository<User> = connection.getRepository(User);

    // Use query builder for JSONB array containment query (@> operator)
    const activityLogs = await repository
      .createQueryBuilder('activityLog')
      .leftJoinAndSelect('activityLog.actor', 'actor')
      .where('activityLog.stakeholders @> :userId', {
        userId: JSON.stringify([currentUserId]),
      })
      .orderBy('activityLog.createdAt', 'DESC')
      .getMany();

    // Get all unique stakeholder IDs
    const stakeholderIds = [
      ...new Set(
        activityLogs
          .flatMap((log) => log.stakeholders || [])
          .filter((id): id is string => !!id),
      ),
    ];

    // Fetch all stakeholders in one query
    const stakeholdersMap = new Map<string, User>();
    if (stakeholderIds.length > 0) {
      const stakeholders = await userRepository.find({
        where: { id: In(stakeholderIds) },
      });
      stakeholders.forEach((user) => {
        stakeholdersMap.set(user.id, user);
      });
    }

    return activityLogs.map((log) => ({
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
              const user = stakeholdersMap.get(stakeholderId);
              return user
                ? {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                  }
                : null;
            })
            .filter(
              (stakeholder): stakeholder is NonNullable<typeof stakeholder> =>
                stakeholder !== null,
            )
        : [],
      actor: log.actor
        ? {
            id: log.actor.id,
            name: log.actor.name,
            email: log.actor.email,
            role: log.actor.role,
            type: log.actorType,
          }
        : null,
    }));
  }
}
