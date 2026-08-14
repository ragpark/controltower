import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiUser, Role } from '@control-tower/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ResolveDuplicatesDto } from './dto';
import { DuplicatesService } from './duplicates.service';

@ApiTags('duplicates')
@ApiBearerAuth()
@Controller('duplicates')
export class DuplicatesController {
  constructor(private readonly duplicates: DuplicatesService) {}

  @Get()
  @Roles(Role.VIEWER)
  @ApiOperation({
    summary: 'Report suspected duplicate order lines',
    description:
      'Read-only. Groups order lines whose natural key differs only by letter case and ' +
      'nominates the most recently imported row as the survivor. Writes nothing.',
  })
  report() {
    return this.duplicates.report();
  }

  @Post('resolve')
  @Roles(Role.OPERATOR)
  @ApiOperation({
    summary: 'Remove superseded duplicate order lines',
    description:
      'Keeps the most recently imported row in each named group and removes the rest. ' +
      'History and rule executions are re-pointed to the survivor and the removed rows are ' +
      'snapshotted into its history before deletion, so the order line keeps its past. ' +
      'Every group must be named explicitly; there is no resolve-everything call.',
  })
  resolve(@Body() dto: ResolveDuplicatesDto, @CurrentUser() user: ApiUser) {
    return this.duplicates.resolve(dto.keys, user.name);
  }
}
