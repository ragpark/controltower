import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { ImportsController } from './imports.controller';
import { OrchestratorService } from './orchestrator.service';
import { SourceSchedulerService } from './scheduler.service';

@Module({
  imports: [RulesModule],
  controllers: [ImportsController],
  providers: [OrchestratorService, SourceSchedulerService],
  exports: [OrchestratorService, SourceSchedulerService],
})
export class ImportsModule {}
