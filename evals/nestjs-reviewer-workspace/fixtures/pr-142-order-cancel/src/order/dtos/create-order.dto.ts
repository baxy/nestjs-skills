import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { AddressDto } from '@/shared/dtos/address.dto';

export class OrderItemDto {
  @ApiProperty({ description: 'Stock keeping unit of the product', example: 'SKU-001' })
  @IsString()
  @MaxLength(64)
  sku: string;

  @ApiProperty({ description: 'Number of units', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Items in the order, 1 to 50', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ description: 'Where the order is shipped', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;
}
