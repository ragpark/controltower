import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiUser, Role } from '@control-tower/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PaginationQuery } from '../common/pagination.dto';
import { OrchestratorService } from '../imports/orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceDto, UpdateSourceDto } from './dto';
import { SourcesService } from './sources.service';

@ApiTags('sources')
@ApiBearerAuth()
@Controller('sources')
export class SourcesController {
  constructor(
    private readonly sources: SourcesService,
    private readonly orchestrator: OrchestratorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(Role.VIEWER)
  list() {
    return this.sources.list();
  }

  @Get('types')
  @Roles(Role.VIEWER)
  types() {
    return this.sources.types();
  }

  @Get(':id')
  @Roles(Role.VIEWER)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sources.get(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSourceDto, @CurrentUser() user: ApiUser) {
    return this.sources.create(dto, user.name);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourceDto,
    @CurrentUser() user: ApiUser,
  ) {
    return this.sources.update(id, dto, user.name);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ApiUser) {
    return this.sources.remove(id, user.name);
  }

  @Post(':id/test')
  @Roles(Role.ADMIN)
  test(@Param('id', ParseUUIDPipe) id: string) {
    return this.sources.testConnection(id);
  }

  @Post(':id/run')
  @Roles(Role.OPERATOR)
  run(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ApiUser) {
    return this.orchestrator.runSource(id, user.name);
  }

  @Get(':id/runs')
  @Roles(Role.VIEWER)
  async runs(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQuery) {
    const where = { sourceId: id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.importRun.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.importRun.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
