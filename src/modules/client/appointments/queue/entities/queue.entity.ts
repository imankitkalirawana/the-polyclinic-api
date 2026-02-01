import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '@/common/patients/entities/patient.entity';
import { Doctor } from '@/common/doctors/entities/doctor.entity';
import { User } from '@/auth/entities/user.entity';
import { PaymentMode } from '../enums/queue.enum';

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
@Index(['doctorId', 'aid', 'appointmentDate', 'sequenceNumber'])
export class Queue {
  // ...
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 12,
    unique: true,
  })
  aid: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  appointmentDate: Date;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.id, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.PAYMENT_FAILED,
  })
  status: QueueStatus;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.id, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  bookedBy: string;

  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'SET NULL',
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'bookedBy' })
  bookedByUser: User;

  @Column({ type: 'int' })
  sequenceNumber: number;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  prescription: string;

  @Column({ type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  paymentMode: PaymentMode;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  completedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'SET NULL',
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'completedBy' })
  completedByUser: User;

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

  @Column({
    type: 'jsonb',
    nullable: true,
    default: {
      by: null,
      remark: null,
    },
  })
  cancellationDetails: {
    by: string;
    remark: string;
  };

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
