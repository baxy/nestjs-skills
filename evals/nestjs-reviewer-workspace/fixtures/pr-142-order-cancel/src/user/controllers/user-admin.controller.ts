import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/shared/decorators/public.decorator';
import { Roles } from '@/shared/decorators/roles.decorator';
import { Role } from '@/shared/types/role';
import { UserIdParamDto } from '../dtos/user-id.param.dto';
import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';

@ApiTags('Users (admin)')
@ApiBearerAuth('bearer')
@Controller('admin/users')
export class UserAdminController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get a user', description: 'Returns any user by id. Administrators only.' })
  @Roles(Role.Admin)
  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }

  @ApiOperation({ summary: 'Delete a user', description: 'Soft-deletes a user. Administrators only.' })
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  delete(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.delete(params.id);
  }
}
