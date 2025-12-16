import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PublicUser } from './public-user.entity';

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

  @ManyToOne(() => PublicUser)
  @JoinColumn({ name: 'userId' })
  user: PublicUser;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
