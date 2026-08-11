import { Global, Module } from '@nestjs/common';
import { ErrorTrackingService } from './error-tracking.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [ErrorTrackingService, MetricsService],
  exports: [ErrorTrackingService, MetricsService],
})
export class ObservabilityModule {}
