import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsObject,
  ValidateIf,
  IsArray,
} from 'class-validator';
import { ActivityAction } from '../enums/activity-action.enum';
import { ActorType } from '../enums/actor-type.enum';
import { EntityType } from '../enums/entity-type.enum';

export class CreateActivityDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsUUID()
  entityId: string;

  @IsString()
  module: string;

  @IsEnum(ActivityAction)
  action: ActivityAction;

  @IsOptional()
  @IsObject()
  changedFields?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  previousData?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  newData?: Record<string, unknown>;

  @IsEnum(ActorType)
  actorType: ActorType;

  @ValidateIf((o) => o.actorType === ActorType.USER)
  @IsOptional()
  @IsUUID()
  actorId?: string | null;

  @IsOptional()
  @IsString()
  actorRole?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  stakeholders?: string[] | null;
}
