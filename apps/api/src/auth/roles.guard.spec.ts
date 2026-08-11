import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@control-tower/shared-types';
import { RolesGuard } from './roles.guard';

function contextFor(user: { roles: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const requireRoles = (roles: Role[] | undefined, isPublic = false) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) =>
        key === 'isPublic' ? isPublic : (roles as never),
      );
  };

  afterEach(() => jest.restoreAllMocks());

  it('allows public routes without a user', () => {
    requireRoles([Role.ADMIN], true);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows routes with no role requirement', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor({ roles: [] }))).toBe(true);
  });

  it('admin satisfies operator and viewer requirements (hierarchy)', () => {
    requireRoles([Role.OPERATOR]);
    expect(guard.canActivate(contextFor({ roles: ['admin'] }))).toBe(true);
    requireRoles([Role.VIEWER]);
    expect(guard.canActivate(contextFor({ roles: ['Admin'] }))).toBe(true);
  });

  it('operator satisfies viewer but not admin', () => {
    requireRoles([Role.VIEWER]);
    expect(guard.canActivate(contextFor({ roles: ['operator'] }))).toBe(true);
    requireRoles([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor({ roles: ['operator'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('viewer cannot access operator routes', () => {
    requireRoles([Role.OPERATOR]);
    expect(() => guard.canActivate(contextFor({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('missing user or unknown roles are rejected', () => {
    requireRoles([Role.VIEWER]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({ roles: ['guest'] }))).toThrow(
      ForbiddenException,
    );
  });
});
