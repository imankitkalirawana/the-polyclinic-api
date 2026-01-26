import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

export enum PatientTenantMembershipStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Entity('patient_tenant_memberships', { schema: 'public' })
@Index(['patientId', 'tenantSlug'], { unique: true })
@Index(['tenantSlug', 'status'])
export class PatientTenantMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'text', name: 'tenant_slug' })
  tenantSlug: string;

  /**
   * Controls whether this tenant can view medical history created in OTHER tenants.
   * Local (same-tenant) records remain visible while membership is ACTIVE.
   */
  @Column({
    type: 'boolean',
    name: 'share_medical_history',
    default: true,
  })
  shareMedicalHistory: boolean;

  @Column({
    type: 'enum',
    enum: PatientTenantMembershipStatus,
    default: PatientTenantMembershipStatus.ACTIVE,
  })
  status: PatientTenantMembershipStatus;

  @Column({ type: 'varchar', length: 100, name: 'tenant_mrn', nullable: true })
  tenantMrn: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
