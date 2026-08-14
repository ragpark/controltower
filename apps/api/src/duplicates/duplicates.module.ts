import { Module } from '@nestjs/common';
import { FailuresModule } from '../failures/failures.module';
import { DuplicatesController } from './duplicates.controller';
import { DuplicatesService } from './duplicates.service';

@Module({
  imports: [FailuresModule],
  controllers: [DuplicatesController],
  providers: [DuplicatesService],
  exports: [DuplicatesService],
})
export class DuplicatesModule {}
