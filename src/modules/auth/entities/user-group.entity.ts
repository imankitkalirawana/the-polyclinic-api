import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entity/base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

@Entity('user_groups', { schema: 'public' })
@Unique(['user_id', 'group_id'])
export class UserGroup extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @Column({ type: 'uuid' })
  @Index()
  group_id: string;

  @Column({ type: 'jsonb', default: {} })
  preferences: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Group, (group) => group.id)
  @JoinColumn({ name: 'group_id' })
  group: Group;
}
