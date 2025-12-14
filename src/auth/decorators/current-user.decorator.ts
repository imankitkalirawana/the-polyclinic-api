import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'generated/prisma/client';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user?.user || request.user;

    return data ? user?.[data] : user;
  },
);
