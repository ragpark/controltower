import { SetMetadata } from '@nestjs/common';
import { Role } from '@control-tower/shared-types';

export const ROLES_KEY = 'roles';
/** Minimum role required for the route. Hierarchy: admin ⊃ operator ⊃ viewer. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
