import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';

@Module({
  controllers: [RulesController],
  providers: [RulesService, ClassificationService],
  exports: [ClassificationService],
})
export class RulesModule {}
