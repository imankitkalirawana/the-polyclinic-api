import { Doctor } from '@/public/doctors/entities/doctor.entity';
import { DoctorTenantMembership } from '@/public/doctors/entities/doctor-tenant-membership.entity';
import { redactField } from 'src/common/utils/redact.util';
import { Role } from 'src/common/enums/role.enum';

export function formatDoctor(
  doctor: Doctor,
  currentRole: Role,
  membership?: DoctorTenantMembership | null,
) {
  return {
    id: doctor.id,
    code: membership?.code ?? null,
    user_id: doctor.user_id,
    name: doctor.user.name,
    email: redactField({
      value: doctor.user.email,
      currentRole,
      targetRole: currentRole,
    }),
    phone: redactField({
      value: doctor.user.phone,
      currentRole,
      targetRole: currentRole,
    }),
    specialization: doctor.specialization,
    education: doctor.education,
    designation: membership?.designation ?? null,
    seating: membership?.seating ?? null,
    experience: doctor.experience,
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt,
  };
}

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomChar(): string {
  return ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
}

export function generateDoctorCode(name: string): string {
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }

  const parts = name.trim().toUpperCase().split(/\s+/).filter(Boolean);

  // Case 1: Two or more words
  if (parts.length >= 2) {
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
    return `${first}${last}${randomChar()}`;
  }

  // Case 2: Single word
  const first = parts[0][0];
  return `${first}${randomChar()}${randomChar()}`;
}
