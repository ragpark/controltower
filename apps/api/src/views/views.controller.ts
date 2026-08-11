import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiUser, Role } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

class CreateViewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  queue!: string;

  @IsObject()
  config!: Record<string, unknown>;
}

class ListViewsQuery {
  @IsOptional()
  @IsString()
  queue?: string;
}

@ApiTags('views')
@ApiBearerAuth()
@Controller('views')
export class ViewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.VIEWER)
  list(@Query() query: ListViewsQuery, @CurrentUser() user: ApiUser) {
    return this.prisma.savedView.findMany({
      where: { createdBy: user.sub, ...(query.queue ? { queue: query.queue } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @Roles(Role.VIEWER)
  create(@Body() dto: CreateViewDto, @CurrentUser() user: ApiUser) {
    return this.prisma.savedView.upsert({
      where: {
        queue_name_createdBy: { queue: dto.queue, name: dto.name, createdBy: user.sub },
      },
      create: {
        name: dto.name,
        queue: dto.queue,
        config: dto.config as Prisma.InputJsonValue,
        createdBy: user.sub,
      },
      update: { config: dto.config as Prisma.InputJsonValue },
    });
  }

  @Delete(':id')
  @Roles(Role.VIEWER)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ApiUser) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('View not found');
    if (view.createdBy !== user.sub) {
      throw new ForbiddenException('You can only delete your own saved views');
    }
    await this.prisma.savedView.delete({ where: { id } });
    return { deleted: true };
  }
}
