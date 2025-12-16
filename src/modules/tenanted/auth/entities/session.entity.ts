import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantUser } from './tenant-user.entity';

@Entity('sessions')
@Index(['token'], { unique: true })
@Index(['expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => TenantUser)
  @JoinColumn({ name: 'userId' })
  user: TenantUser;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

