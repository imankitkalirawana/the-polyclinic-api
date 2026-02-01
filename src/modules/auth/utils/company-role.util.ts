import { BadRequestException } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { CompanyType } from '../entities/company.entity';

export const INTERNAL_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.MODERATOR,
  Role.OPS,
]);

export const CLIENT_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.ADMIN,
  Role.PATIENT,
  Role.DOCTOR,
  Role.NURSE,
  Role.RECEPTIONIST,
]);

export function assertRoleAllowedForCompanyType(
  role: Role,
  companyType: CompanyType,
): void {
  const allowed =
    companyType === CompanyType.THE_POLYCLINIC
      ? INTERNAL_ROLES.has(role)
      : CLIENT_ROLES.has(role);

  if (!allowed) {
    throw new BadRequestException(
      `Role ${role} is not allowed for company type ${companyType}`,
    );
  }
}

export function inferCompanyTypeForRole(role: Role): CompanyType {
  if (INTERNAL_ROLES.has(role)) return CompanyType.THE_POLYCLINIC;
  return CompanyType.CLIENT;
}

export function defaultRoleForCompanyType(companyType: CompanyType): Role {
  return companyType === CompanyType.THE_POLYCLINIC ? Role.OPS : Role.PATIENT;
}
