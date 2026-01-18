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
import { User } from '../../../common/users/entities/user.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // References public.users table - cross-schema FK
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 3, unique: true, nullable: true })
  code?: string;

  // Note: This is a logical reference to public.users
  // The actual FK constraint is handled at the database level
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
