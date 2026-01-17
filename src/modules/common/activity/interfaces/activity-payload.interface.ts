import { ActivityAction } from '../enums/activity-action.enum';
import { ActorType } from '../enums/actor-type.enum';
import { EntityType } from '../enums/entity-type.enum';

export interface ActivityLogPayload {
  entityType: EntityType;
  entityId: string;
  module: string;
  action: ActivityAction;
  changedFields?: Record<string, any>;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  actorType: ActorType;
  actorId?: string | null;
  actorRole?: string | null;
  description?: string | null;
  stakeholders?: string[] | null;
  tenantSlug?: string;
}
