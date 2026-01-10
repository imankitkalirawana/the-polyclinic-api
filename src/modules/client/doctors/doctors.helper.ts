import { Doctor } from './entities/doctor.entity';
import { redactField } from 'src/common/utils/redact.util';
import { Role } from 'src/common/enums/role.enum';

export function formatDoctor(doctor: Doctor, currentRole: Role) {
  return {
    id: doctor.id,
    userId: doctor.userId,
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
    image: doctor.user.image,
    lastSequenceNumber: doctor.lastSequenceNumber,
    specialization: doctor.specialization,
    designation: doctor.designation,
    seating: doctor.seating,
    experience: doctor.experience,
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt,
  };
}
