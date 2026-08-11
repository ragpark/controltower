import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ApiUser, ImportRunStatus, Role } from '@control-tower/shared-types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PaginationQuery } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorService } from './orchestrator.service';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

class RunsQuery extends PaginationQuery {
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsEnum(ImportRunStatus)
  status?: ImportRunStatus;
}

class UploadBody {
  @IsUUID()
  sourceId!: string;
}

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @Roles(Role.OPERATOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        sourceId: { type: 'string', format: 'uuid' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadBody,
    @CurrentUser() user: ApiUser,
  ) {
    if (!file) throw new BadRequestException('A CSV file is required (field name "file")');
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
      throw new BadRequestException('Only .csv and .txt files are supported');
    }
    return this.orchestrator.importUpload(
      body.sourceId,
      { filename: file.originalname, content: file.buffer },
      user.name,
    );
  }

  @Get('runs')
  @Roles(Role.VIEWER)
  async runs(@Query() query: RunsQuery) {
    const where = {
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.importRun.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { source: { select: { name: true } } },
      }),
      this.prisma.importRun.count({ where }),
    ]);
    return {
      items: items.map(({ source, ...run }) => ({ ...run, sourceName: source.name })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Get('runs/:id')
  @Roles(Role.VIEWER)
  async run(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.prisma.importRun.findUnique({
      where: { id },
      include: { source: { select: { name: true } } },
    });
    if (!run) throw new NotFoundException('Import run not found');
    const { source, ...rest } = run;
    return { ...rest, sourceName: source.name };
  }
}
