import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiUser, Role } from '@control-tower/shared-types';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ClassificationService } from './classification.service';
import { CreateRuleDto, RulePreviewDto, UpdateRuleDto } from './dto';
import { RulesService } from './rules.service';

class ReapplyDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds?: string[];
}

@ApiTags('rules')
@ApiBearerAuth()
@Controller('rules')
export class RulesController {
  constructor(
    private readonly rules: RulesService,
    private readonly classification: ClassificationService,
  ) {}

  @Get()
  @Roles(Role.VIEWER)
  list() {
    return this.rules.list();
  }

  @Get('strategies')
  @Roles(Role.VIEWER)
  strategies() {
    return this.rules.strategies();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateRuleDto, @CurrentUser() user: ApiUser) {
    return this.rules.create(dto, user.name);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() user: ApiUser,
  ) {
    return this.rules.update(id, dto, user.name);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ApiUser) {
    return this.rules.remove(id, user.name);
  }

  @Post('preview')
  @Roles(Role.ADMIN)
  preview(@Body() dto: RulePreviewDto) {
    return this.rules.preview(dto);
  }

  @Post('reapply')
  @Roles(Role.OPERATOR)
  async reapply(@Body() dto: ReapplyDto, @CurrentUser() user: ApiUser) {
    const count = await this.classification.reapply(dto.orderIds ?? null, user.name);
    return { reclassified: count };
  }
}
