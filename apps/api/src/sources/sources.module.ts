import { Module } from '@nestjs/common';
import { ImportsModule } from '../imports/imports.module';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [ImportsModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}
