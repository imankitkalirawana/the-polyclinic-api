import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { ActivityLog } from './modules/common/activity/entities/activity-log.entity';
import { User } from './modules/auth/entities/user.entity';
import { Session } from './modules/auth/entities/session.entity';
import { Patient } from './modules/public/patients/entities/patient.entity';
import { PatientTenantMembership } from './modules/public/patients/entities/patient-tenant-membership.entity';
import { ClinicalRecord } from './modules/public/clinical/entities/clinical-record.entity';
import { PatientMembershipAuditLog } from './modules/public/patients/entities/patient-membership-audit.entity';
import { Doctor } from './modules/public/doctors/entities/doctor.entity';
import { DoctorTenantMembership } from './modules/public/doctors/entities/doctor-tenant-membership.entity';
import { DoctorMembershipAuditLog } from './modules/public/doctors/entities/doctor-membership-audit.entity';

export function getTenantConnectionConfig(
  tenantSlug: string,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: tenantSlug,
    entities: [
      join(__dirname, './modules/client/**/entities/*.entity.{ts,js}'),
      ActivityLog,
      // Allow tenant schema entities to reference global users in public schema
      User,
      // Needed because User has relations to Session
      Session,
      // Public schema: global patient + access control + shared records
      Patient,
      PatientTenantMembership,
      ClinicalRecord,
      PatientMembershipAuditLog,
      // Public schema: global doctors + per-tenant membership
      Doctor,
      DoctorTenantMembership,
      DoctorMembershipAuditLog,
    ],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
    // ssl: {
    //   rejectUnauthorized: false,
    // },
  };
}
