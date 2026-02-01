import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';

export type CurrentUserPayload = {
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  session_id: string;
};

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
