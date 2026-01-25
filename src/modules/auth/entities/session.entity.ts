import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
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

  @Column({ type: 'boolean', default: true })
  logged_in: boolean;

  @Column({ type: 'timestamp', nullable: true })
  logged_out_at: Date;

  @Column({ type: 'timestamp' })
  @Index()
  expires_at: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @ManyToOne(() => User, (user) => user.sessions)
  @JoinColumn({ name: 'userId' })
  user: User;

  isValid(): boolean {
    return this.logged_in && new Date() < this.expires_at;
  }
}
