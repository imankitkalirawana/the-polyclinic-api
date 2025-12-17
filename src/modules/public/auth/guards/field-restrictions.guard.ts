import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RESTRICT_FIELDS_KEY,
  FieldRestriction,
} from '../decorators/restrict-fields.decorator';
import {
  ALLOW_FIELDS_KEY,
  FieldAllowance,
} from '../decorators/allow-fields.decorator';

@Injectable()
export class FieldRestrictionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowances = this.reflector.getAllAndOverride<FieldAllowance[]>(
      ALLOW_FIELDS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const restrictions = this.reflector.getAllAndOverride<FieldRestriction[]>(
      RESTRICT_FIELDS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If nothing to enforce, allow the request
    if (
      (!allowances || allowances.length === 0) &&
      (!restrictions || restrictions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user, body } = request;

    // If no user or body, allow (other guards will handle auth)
    if (!user || !body) {
      return true;
    }

    // Apply allowed fields first (if any)
    const applicableAllowances = (allowances ?? []).filter((allowance) => {
      if (Array.isArray(allowance.role)) {
        return allowance.role.includes(user.role);
      }
      return allowance.role === user.role;
    });

    if (applicableAllowances.length > 0) {
      const allowedFields = new Set<string>();
      applicableAllowances.forEach((allowance) => {
        allowance.fields.forEach((field) => allowedFields.add(field));
      });

      Object.keys(body).forEach((field) => {
        if (!allowedFields.has(field)) {
          delete body[field];
        }
      });
    }

    // Find all restrictions that apply to the current user's role
    const applicableRestrictions = (restrictions ?? []).filter(
      (restriction) => {
        if (Array.isArray(restriction.role)) {
          return restriction.role.includes(user.role);
        }
        return restriction.role === user.role;
      },
    );

    if (applicableRestrictions.length > 0) {
      // Collect all restricted fields from all applicable restrictions
      const restrictedFields = new Set<string>();
      applicableRestrictions.forEach((restriction) => {
        restriction.fields.forEach((field) => restrictedFields.add(field));
      });

      // Silently filter out restricted fields from the request body
      restrictedFields.forEach((field) => {
        delete body[field];
      });
    }

    return true;
  }
}
