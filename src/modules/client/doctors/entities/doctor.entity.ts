import {
  Column,
  CreateDateColumn,
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

  @Column({ type: 'text', nullable: true })
  experience?: string;

  @Column({ type: 'text', nullable: true })
  education?: string;

  @Column({ type: 'text', nullable: true })
  biography?: string;

  @Column({ nullable: true })
  seating?: string;

  @Column({ nullable: true })
  lastSequenceNumber?: number;

  @Column({ nullable: true })
  currentSequenceNumber?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
