import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator to restrict access to endpoints based on user roles.
 *
 * Usage examples:
 * - Single role: @Roles('admin')
 * - Multiple roles: @Roles('admin', 'doctor')
 * - Array of roles: @Roles(['admin', 'doctor'])
 */
export const Roles = (...roles: string[] | [string[]]) => {
  // Flatten the array in case an array was passed as a single argument
  // This handles both @Roles('admin', 'doctor') and @Roles(['admin', 'doctor'])
  const rolesArray = roles.flat();
  return SetMetadata(ROLES_KEY, rolesArray);
};
