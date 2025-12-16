import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';

export const RESTRICT_FIELDS_KEY = 'restrictFields';

export interface FieldRestriction {
  role: Role;
  fields: string[];
}

/**
 * Decorator to restrict certain fields from being updated by specific roles
 * @param restrictions Array of role-based field restrictions
 * @example
 * @RestrictFields([
 *   { role: Role.moderator, fields: ['email', 'role'] },
 *   { role: Role.ops, fields: ['email', 'role', 'password'] }
 * ])
 */
export const RestrictFields = (...restrictions: FieldRestriction[]) =>
  SetMetadata(RESTRICT_FIELDS_KEY, restrictions);
