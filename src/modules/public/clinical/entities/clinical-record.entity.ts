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
import { Patient } from '@/public/patients/entities/patient.entity';

export enum ClinicalRecordType {
  APPOINTMENT_NOTE = 'APPOINTMENT_NOTE',
  PRESCRIPTION = 'PRESCRIPTION',
}

@Entity('patient_clinical_records', { schema: 'public' })
@Index(['patientId', 'encounterRef', 'recordType'], { unique: true })
@Index(['patientId', 'occurredAt'])
@Index(['sourceTenantSlug', 'patientId'])
export class ClinicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'text', name: 'source_tenant_slug' })
  sourceTenantSlug: string;

  @Column({ type: 'text', name: 'encounter_ref', nullable: true })
  encounterRef: string | null;

  @Column({ type: 'timestamp with time zone', name: 'occurred_at' })
  occurredAt: Date;

  @Column({ type: 'enum', enum: ClinicalRecordType, name: 'record_type' })
  recordType: ClinicalRecordType;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'uuid', name: 'amended_record_id', nullable: true })
  amendedRecordId: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
