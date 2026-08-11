import { Module } from '@nestjs/common';
import { FailuresModule } from '../failures/failures.module';
import { RulesModule } from '../rules/rules.module';
import { ImportsController } from './imports.controller';
import { OrchestratorService } from './orchestrator.service';
import { SourceSchedulerService } from './scheduler.service';

@Module({
  imports: [RulesModule, FailuresModule],
  controllers: [ImportsController],
  providers: [OrchestratorService, SourceSchedulerService],
  exports: [OrchestratorService, SourceSchedulerService],
})
export class ImportsModule {}
