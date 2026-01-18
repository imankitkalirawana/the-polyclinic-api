import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';

export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: Role;
  sessionId: string;
  tenantSlug: string | null;
  name: string;
  phone: string | null;
  patientId?: string | null;
  doctorId?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
