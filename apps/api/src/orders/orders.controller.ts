import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiUser, Role } from '@control-tower/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { BulkOrdersDto, ListOrdersQuery } from './dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @Roles(Role.VIEWER)
  list(@Query() query: ListOrdersQuery) {
    return this.orders.list(query);
  }

  @Get('export')
  @Roles(Role.VIEWER)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="orders-export.csv"')
  export(@Query() query: ListOrdersQuery, @CurrentUser() user: ApiUser) {
    return this.orders.exportCsv(query, user.name);
  }

  @Get(':id')
  @Roles(Role.VIEWER)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Get(':id/trace')
  @Roles(Role.VIEWER)
  trace(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.trace(id);
  }

  @Get(':id/history')
  @Roles(Role.VIEWER)
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.history(id);
  }

  @Get(':id/related')
  @Roles(Role.VIEWER)
  related(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.related(id);
  }

  @Get(':id/audit')
  @Roles(Role.VIEWER)
  auditTrail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.auditTrail(id);
  }

  @Post('bulk')
  @Roles(Role.OPERATOR)
  bulk(@Body() dto: BulkOrdersDto, @CurrentUser() user: ApiUser) {
    return this.orders.bulk(dto, user.name);
  }
}
