import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { FailuresController } from './failures.controller';
import { FailuresService } from './failures.service';

@Module({
  imports: [RulesModule],
  controllers: [FailuresController],
  providers: [FailuresService],
  exports: [FailuresService],
})
export class FailuresModule {}
