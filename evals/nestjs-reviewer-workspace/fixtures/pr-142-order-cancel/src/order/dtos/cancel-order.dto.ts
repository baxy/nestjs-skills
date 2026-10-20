import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Why the caller cancels the order', example: 'Ordered by mistake' })
  @IsOptional()
  @IsString()
  reason?: string;
}
