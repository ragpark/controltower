import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AuditModule } from './audit/audit.module';
import { ObservabilityModule } from './observability/observability.module';
import { RequestLoggerMiddleware } from './observability/request-logger.middleware';
import { SourcesModule } from './sources/sources.module';
import { ImportsModule } from './imports/imports.module';
import { RulesModule } from './rules/rules.module';
import { DuplicatesModule } from './duplicates/duplicates.module';
import { FailuresModule } from './failures/failures.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ViewsModule } from './views/views.module';
import { AggregatesModule } from './aggregates/aggregates.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    ObservabilityModule,
    AuthModule,
    AuditModule,
    AggregatesModule,
    RulesModule,
    FailuresModule,
    DuplicatesModule,
    ImportsModule,
    SourcesModule,
    OrdersModule,
    DashboardModule,
    ViewsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
