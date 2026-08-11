import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ApiUser } from '@control-tower/shared-types';

interface EntraJwtPayload {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  roles?: string[];
  scp?: string;
}

/**
 * Validates Entra ID (v2.0) access tokens: signature via tenant JWKS,
 * issuer + audience checks. App roles arrive in the `roles` claim.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const tenantId = config.get<string>('auth.tenantId') || 'common';
    const audience = config.get<string>('auth.audience');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      }),
    });
  }

  validate(payload: EntraJwtPayload): ApiUser {
    return {
      sub: payload.sub,
      name: payload.name ?? payload.preferred_username ?? payload.sub,
      email: payload.email ?? payload.preferred_username,
      roles: payload.roles ?? [],
    };
  }
}
