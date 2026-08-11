import { BulkOrderAction, Classification } from '@control-tower/shared-types';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQuery } from '../common/pagination.dto';

export const ORDER_SORT_FIELDS = [
  'orderNumber',
  'orderSource',
  'customerName',
  'customerEmail',
  'productCode',
  'productName',
  'orderStatus',
  'orderState',
  'licenceOrderMatch',
  'licenceIsbnMatch',
  'classification',
  'orderDate',
  'importedAt',
  'updatedAt',
  'value',
  'quantity',
] as const;

export class ListOrdersQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(Classification)
  classification?: Classification;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  orderState?: string;

  @IsOptional()
  @IsString()
  orderSource?: string;

  @IsOptional()
  @IsString()
  licenceOrderMatch?: string;

  @IsOptional()
  @IsString()
  licenceIsbnMatch?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(ORDER_SORT_FIELDS as unknown as string[])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

export class BulkOrdersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['reclassify', 'rerun-rules'])
  action!: BulkOrderAction;

  @IsOptional()
  @IsEnum(Classification)
  classification?: Classification;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
