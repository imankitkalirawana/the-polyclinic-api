import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';

export const ALLOW_FIELDS_KEY = 'allowFields';

export interface FieldAllowance {
  role: Role | Role[];
  fields: string[];
}

/**
 * Decorator to allow only specific fields to be updated by specific roles
 * @param allowances Array of role-based allowed fields
 */
export const AllowFields = (...allowances: FieldAllowance[]) =>
  SetMetadata(ALLOW_FIELDS_KEY, allowances);
