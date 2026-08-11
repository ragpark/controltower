import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@control-tower/shared-types';
import { IS_PUBLIC_KEY } from './public.decorator';

export const DEV_USER = {
  sub: 'local-dev',
  name: 'Local Developer',
  email: 'dev@localhost',
  roles: [Role.ADMIN],
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!this.config.get<boolean>('auth.enabled')) {
      // Local development mode — inject a deterministic admin identity.
      const request = context.switchToHttp().getRequest();
      request.user = DEV_USER;
      return true;
    }
    return super.canActivate(context);
  }
}
