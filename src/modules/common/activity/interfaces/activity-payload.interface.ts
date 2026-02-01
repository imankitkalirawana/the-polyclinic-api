import { ActivityAction } from '../enums/activity-action.enum';
import { ActorType } from '../enums/actor-type.enum';
import { EntityType } from '../enums/entity-type.enum';

export interface ActivityLogPayload {
  entityType: EntityType;
  entityId: string;
  module: string;
  action: ActivityAction;
  changedFields?: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  actorType: ActorType;
  actorId?: string | null;
  actorRole?: string | null;
  description?: string | null;
  stakeholders?: string[] | null;
  tenantSlug?: string;
}
