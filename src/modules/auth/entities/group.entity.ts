import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from 'src/common/entity/base.entity';
import { Company, CompanyType } from './company.entity';
import { User } from './user.entity';

@Entity('login_groups', { schema: 'public' })
export class Group extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  company_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  unique_id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  schema: string; // 'app', 'client_1', etc.

  @Column({ type: 'varchar' })
  company_type: CompanyType;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  time_zone: string;

  @Column({ type: 'jsonb', default: {} })
  configuration: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @ManyToOne(() => Company, (company) => company.groups)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @OneToMany(() => User, (user) => user.id)
  users: User[];
}
