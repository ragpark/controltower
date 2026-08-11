import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiUser, Role } from '@control-tower/shared-types';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

/** admin satisfies operator, operator satisfies viewer. */
const GRANTS: Record<string, Role[]> = {
  [Role.ADMIN]: [Role.ADMIN, Role.OPERATOR, Role.VIEWER],
  [Role.OPERATOR]: [Role.OPERATOR, Role.VIEWER],
  [Role.VIEWER]: [Role.VIEWER],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as ApiUser | undefined;
    const effective = new Set(
      (user?.roles ?? []).flatMap((r) => GRANTS[r.toLowerCase()] ?? []),
    );
    if (!required.some((role) => effective.has(role))) {
      throw new ForbiddenException(
        `Requires one of roles: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
