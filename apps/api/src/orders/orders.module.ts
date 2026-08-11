import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [RulesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
