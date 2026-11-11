import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SafeUser } from '../users/utils/sanitize-user.util';

export type AuthenticatedUser = SafeUser & { refreshToken?: string };

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
