import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantUser } from '../../users/entities/tenant-user.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => TenantUser, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: TenantUser;

  @Column({ nullable: true })
  specialization?: string;

  @Column({ nullable: true })
  designation?: string;

  @Column('text', { array: true, nullable: true })
  departments?: string[];

  @Column({ type: 'integer', nullable: true })
  experience?: number;

  @Column({ type: 'text', nullable: true })
  education?: string;

  @Column({ type: 'text', nullable: true })
  biography?: string;

  @Column({ nullable: true })
  seating?: string;

  @Column({ default: 0 })
  lastSequenceNumber?: number;

  @Column({ default: 0 })
  currentSequenceNumber?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
