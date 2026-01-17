import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ActivityAction } from '../enums/activity-action.enum';
import { ActorType } from '../enums/actor-type.enum';
import { EntityType } from '../enums/entity-type.enum';
import { TenantUser } from '@/client/users/entities/tenant-user.entity';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  entityType: EntityType;

  @Column({ type: 'uuid' })
  @Index()
  entityId: string;

  @Column({ type: 'varchar', length: 255 })
  module: string;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({ type: 'jsonb', nullable: true })
  changedFields: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  previousData: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  newData: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: ActorType,
  })
  actorType: ActorType;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  actorId: string | null;

  @ManyToOne(() => TenantUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: TenantUser | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorRole: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  @Index()
  stakeholders: string[] | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  createdAt: Date;
}
