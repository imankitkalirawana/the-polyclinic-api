import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entity/base.entity';
import { Group } from './group.entity';

export enum CompanyType {
  THE_POLYCLINIC = 'THE_POLYCLINIC',
  CLIENT = 'CLIENT',
}

@Entity('login_companies', { schema: 'public' })
export class Company extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  company_code: string;

  @Column({ type: 'varchar' })
  @Index()
  company_type: CompanyType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  schema: string; // 'app', 'client_1', etc.

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 100, default: 'Asia/Kolkata' })
  time_zone: string;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @OneToMany(() => Group, (group) => group.company)
  groups: Group[];
}
