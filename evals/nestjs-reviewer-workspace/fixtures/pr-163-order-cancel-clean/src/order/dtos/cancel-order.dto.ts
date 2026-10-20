import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Why the caller cancels the order', example: 'Ordered by mistake' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
