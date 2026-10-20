import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class FindAllUsersQueryDto {
  @ApiPropertyOptional({ description: 'Maximum number of users to return', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Number of users to skip from the start', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({ description: 'Matches the start of the name or email', example: 'jane' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
