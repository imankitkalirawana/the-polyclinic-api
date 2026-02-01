import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from 'src/common/entity/base.entity';
import { User } from './user.entity';

@Entity('login_sessions', { schema: 'public' })
export class Session extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @Column({ type: 'text' })
  @Index()
  auth_token_digest: string; // Hashed JWT token

  @Column({ type: 'timestamp' })
  @Index()
  expires_at: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @ManyToOne(() => User, (user) => user.sessions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @DeleteDateColumn()
  deletedAt?: Date;
}
