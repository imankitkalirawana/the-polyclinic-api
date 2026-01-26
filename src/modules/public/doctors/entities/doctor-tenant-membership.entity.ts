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
import { Doctor } from './doctor.entity';

export enum DoctorTenantMembershipStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Entity('doctor_tenant_memberships', { schema: 'public' })
@Index(['doctorId', 'tenantSlug'], { unique: true })
@Index(['tenantSlug', 'status'])
@Index(['tenantSlug', 'code'], { unique: true })
export class DoctorTenantMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'doctor_id' })
  doctorId: string;

  @ManyToOne(() => Doctor, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ type: 'text', name: 'tenant_slug' })
  tenantSlug: string;

  @Column({
    type: 'enum',
    enum: DoctorTenantMembershipStatus,
    default: DoctorTenantMembershipStatus.ACTIVE,
  })
  status: DoctorTenantMembershipStatus;

  // Tenant-specific fields
  @Column({ type: 'varchar', length: 3, nullable: true })
  code?: string | null;

  @Column({ nullable: true })
  designation?: string | null;

  @Column({ nullable: true })
  seating?: string | null;

  @Column('text', { array: true, nullable: true })
  departments?: string[] | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
