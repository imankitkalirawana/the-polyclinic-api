import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entity/base.entity';
import { CompanyType } from './company.entity';
import { Role } from 'src/common/enums/role.enum';
import { Session } from './session.entity';
import { UserGroup } from './user-group.entity';

@Entity('login_users', { schema: 'public' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  password_digest: string;

  @Column({ type: 'varchar' })
  role: Role;

  @Column({ type: 'varchar' })
  @Index()
  company_type: CompanyType;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  time_zone: string;

  @Column({ type: 'jsonb', default: {} })
  permissions: Record<string, any>;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => UserGroup, (userGroup) => userGroup.user)
  groups: UserGroup[];
}
