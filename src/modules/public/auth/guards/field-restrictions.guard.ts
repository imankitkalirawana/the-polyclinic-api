import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RESTRICT_FIELDS_KEY,
  FieldRestriction,
} from '../decorators/restrict-fields.decorator';

@Injectable()
export class FieldRestrictionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const restrictions = this.reflector.getAllAndOverride<FieldRestriction[]>(
      RESTRICT_FIELDS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no restrictions are defined, allow the request
    if (!restrictions || restrictions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user, body } = request;

    // If no user or body, allow (other guards will handle auth)
    if (!user || !body) {
      return true;
    }

    // Find all restrictions that apply to the current user's role
    const applicableRestrictions = restrictions.filter((restriction) => {
      // Check if single role matches
      if (Array.isArray(restriction.role)) {
        return restriction.role.includes(user.role);
      }
      // Check if single role matches
      return restriction.role === user.role;
    });

    // If no restrictions for this role, allow
    if (applicableRestrictions.length === 0) {
      return true;
    }

    // Collect all restricted fields from all applicable restrictions
    const restrictedFields = new Set<string>();
    applicableRestrictions.forEach((restriction) => {
      restriction.fields.forEach((field) => restrictedFields.add(field));
    });

    // Silently filter out restricted fields from the request body
    restrictedFields.forEach((field) => {
      delete body[field];
    });

    return true;
  }
}
