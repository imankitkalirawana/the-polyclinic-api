import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '@/client/patients/entities/patient.entity';
import { Doctor } from '@/client/doctors/entities/doctor.entity';
import { TenantUser } from '@/client/auth/entities/tenant-user.entity';
import { Payment } from '@/client/payments/entities/payment.entity';

export enum QueueStatus {
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  BOOKED = 'BOOKED',
  CALLED = 'CALLED',
  IN_CONSULTATION = 'IN_CONSULTATION',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export interface Counter {
  skip: number;
  clockIn: number;
  call: number;
}

@Entity('appointment_queue')
export class Queue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'enum', enum: QueueStatus, default: QueueStatus.BOOKED })
  status: QueueStatus;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  bookedBy: string;

  @ManyToOne(() => TenantUser, (user) => user.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'bookedBy' })
  bookedByUser: TenantUser;

  @Column({ type: 'int' })
  sequenceNumber: number;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  prescription: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  completedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @ManyToOne(() => TenantUser, (user) => user.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'completedBy' })
  completedByUser: TenantUser;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: {
      skip: 0,
      clockIn: 0,
      call: 0,
    },
  })
  counter: Counter;

  // payment related fields
  @Column({ type: 'uuid', nullable: true })
  paymentId: string;

  @ManyToOne(() => Payment, (payment) => payment.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
