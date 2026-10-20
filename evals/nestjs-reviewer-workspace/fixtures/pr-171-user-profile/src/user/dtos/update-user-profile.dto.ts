import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPhoneNumber, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AddressDto } from '@/shared/dtos/address.dto';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Display name', example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Mobile number in international format', example: '+14155550123' })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Name of the organisation the user works for', example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organization?: string;

  @ApiPropertyOptional({ description: 'Postal address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  address?: AddressDto;
}
