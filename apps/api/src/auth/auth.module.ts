import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

/**
 * The JWT strategy is only registered when AUTH_ENABLED=true so local
 * development needs no Entra tenant. The guard injects a dev identity instead.
 */
@Module({
  imports: [PassportModule],
  providers: [
    {
      provide: 'JWT_STRATEGY',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<boolean>('auth.enabled') ? new JwtStrategy(config) : null,
    },
  ],
})
export class AuthModule {}
