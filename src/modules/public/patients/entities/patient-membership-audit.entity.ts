import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum PatientMembershipAuditAction {
  MEMBERSHIP_CREATED = 'MEMBERSHIP_CREATED',
  MEMBERSHIP_RESTORED = 'MEMBERSHIP_RESTORED',
  MEMBERSHIP_REVOKED = 'MEMBERSHIP_REVOKED',
  SHARING_UPDATED = 'SHARING_UPDATED',
}

@Entity('patient_membership_audit_logs', { schema: 'public' })
@Index(['patientId', 'tenantSlug', 'createdAt'])
export class PatientMembershipAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @Column({ type: 'text', name: 'tenant_slug' })
  tenantSlug: string;

  @Column({ type: 'enum', enum: PatientMembershipAuditAction })
  action: PatientMembershipAuditAction;

  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'text', name: 'actor_role', nullable: true })
  actorRole: string | null;

  @Column({ type: 'jsonb', default: {} })
  before: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  after: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
