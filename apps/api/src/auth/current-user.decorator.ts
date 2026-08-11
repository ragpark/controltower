import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiUser } from '@control-tower/shared-types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as ApiUser;
  },
);
