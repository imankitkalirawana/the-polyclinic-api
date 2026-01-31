import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entity/base.entity';

export enum VerificationType {
  LOGIN = 'LOGIN',
  REGISTRATION = 'REGISTRATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Entity('login_verifications', { schema: 'public' })
export class Verification extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 255 })
  token: string;

  @Column({ type: 'varchar', length: 6 })
  otp: string;

  @Column({ type: 'enum', enum: VerificationType })
  type: VerificationType;

  @Column({ type: 'timestamp' })
  expiry_date: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
