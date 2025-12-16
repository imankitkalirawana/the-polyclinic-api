import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';

export const RESTRICT_FIELDS_KEY = 'restrictFields';

export interface FieldRestriction {
  role: Role | Role[];
  fields: string[];
}

/**
 * Decorator to restrict certain fields from being updated by specific roles
 * @param restrictions Array of role-based field restrictions
 * @example
 * // Single role
 * @RestrictFields({ role: Role.moderator, fields: ['email', 'role'] })
 *
 * // Array of roles
 * @RestrictFields({ role: [Role.moderator, Role.ops], fields: ['email', 'role'] })
 *
 * // Multiple restrictions
 * @RestrictFields(
 *   { role: Role.moderator, fields: ['email', 'role'] },
 *   { role: [Role.ops, Role.moderator], fields: ['password'] }
 * )
 */
export const RestrictFields = (...restrictions: FieldRestriction[]) =>
  SetMetadata(RESTRICT_FIELDS_KEY, restrictions);
