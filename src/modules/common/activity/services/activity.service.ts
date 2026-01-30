import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { ActivityAction } from '../enums/activity-action.enum';
import { ActorType } from '../enums/actor-type.enum';
import { EntityType } from '../enums/entity-type.enum';
import { diffObjects } from '../utils/diff.util';
import { formatLabel } from 'src/common/utils/text-transform.util';

interface LogUpdateOptions {
  entityType: EntityType;
  entityId: string;
  module: string;
  before: any;
  after: any;
  description?: string;
  stakeholders?: string[];
}

interface LogStatusChangeOptions {
  entityType: EntityType;
  entityId: string;
  module: string;
  before: any;
  after: any;
  description?: string;
  additionalFields?: Record<string, { before: any; after: any }>;
  stakeholders?: string[];
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Optional() @Inject(REQUEST) private readonly request?: Request,
  ) {}

  logActivity(payload: CreateActivityDto): void {
    const isEnabled = process.env.ACTIVITY_LOG_ENABLED !== 'false';

    if (!isEnabled) {
      return;
    }

    try {
      const schema = this.request?.schema;
      const eventPayload = {
        ...payload,
        schema,
      };
      this.eventEmitter.emit('activity.log', eventPayload);
    } catch (error) {
      this.logger.error('Failed to emit activity log event', error);
    }
  }

  logUpdate(options: LogUpdateOptions): void {
    const {
      entityType,
      entityId,
      module,
      before,
      after,
      description,
      stakeholders,
    } = options;
    const changedFields = diffObjects(before, after);

    if (Object.keys(changedFields).length === 0) {
      return;
    }

    this.logActivity({
      entityType,
      entityId,
      module,
      action: ActivityAction.UPDATED,
      changedFields,
      previousData: before,
      newData: after,
      actorType: this.getActorType(),
      actorId: this.getActorId(),
      actorRole: this.getActorRole(),
      description,
      stakeholders,
    });
  }

  logStatusChange(options: LogStatusChangeOptions): void {
    const {
      entityType,
      entityId,
      module,
      before,
      after,
      description,
      additionalFields = {},
      stakeholders,
    } = options;

    const statusField = 'status';
    const beforeStatus = formatLabel(before[statusField]);
    const afterStatus = formatLabel(after[statusField]);

    if (
      beforeStatus === afterStatus &&
      Object.keys(additionalFields).length === 0
    ) {
      return;
    }

    const changedFields: Record<string, any> = {
      ...additionalFields,
    };

    if (beforeStatus !== afterStatus) {
      changedFields[statusField] = {
        before: beforeStatus,
        after: afterStatus,
      };
    }

    const defaultDescription =
      description || `Status changed from ${beforeStatus} to ${afterStatus}`;

    this.logActivity({
      entityType,
      entityId,
      module,
      action: ActivityAction.STATUS_CHANGED,
      changedFields,
      previousData: before,
      newData: after,
      actorType: this.getActorType(),
      actorId: this.getActorId(),
      actorRole: this.getActorRole(),
      description: defaultDescription,
      stakeholders,
    });
  }

  logCreate({
    entityType,
    entityId,
    module,
    data,
    description,
    stakeholders,
  }: {
    entityType: EntityType;
    entityId: string;
    module: string;
    data: any;
    description?: string;
    stakeholders?: string[];
  }): void {
    this.logActivity({
      entityType,
      entityId,
      module,
      action: ActivityAction.CREATED,
      newData: data,
      actorType: this.getActorType(),
      actorId: this.getActorId(),
      actorRole: this.getActorRole(),
      description,
      stakeholders,
    });
  }

  logDelete({
    entityType,
    entityId,
    module,
    data,
    description,
    stakeholders,
  }: {
    entityType: EntityType;
    entityId: string;
    module: string;
    data: any;
    description?: string;
    stakeholders?: string[];
  }): void {
    this.logActivity({
      entityType,
      entityId,
      module,
      action: ActivityAction.DELETED,
      previousData: data,
      actorType: this.getActorType(),
      actorId: this.getActorId(),
      actorRole: this.getActorRole(),
      description,
      stakeholders,
    });
  }

  logSoftDelete(
    entityType: EntityType,
    entityId: string,
    module: string,
    data: any,
    description?: string,
    stakeholders?: string[],
  ): void {
    this.logActivity({
      entityType,
      entityId,
      module,
      action: ActivityAction.SOFT_DELETED,
      previousData: data,
      actorType: this.getActorType(),
      actorId: this.getActorId(),
      actorRole: this.getActorRole(),
      description,
      stakeholders,
    });
  }

  private getActorType(): ActorType {
    return this.request?.user ? ActorType.USER : ActorType.SYSTEM;
  }

  private getActorId(): string | null {
    return this.request?.user?.userId || null;
  }

  private getActorRole(): string | null {
    return this.request?.user?.role || null;
  }
}
