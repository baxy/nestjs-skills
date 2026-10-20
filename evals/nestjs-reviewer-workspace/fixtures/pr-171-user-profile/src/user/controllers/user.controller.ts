import { Body, Controller, Get, Param, Patch, Query, Res, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { OrderHistoryService } from '@/order/services/order-history.service';
import { AuthUser } from '@/shared/decorators/auth-user.decorator';
import { Roles } from '@/shared/decorators/roles.decorator';
import { TimeoutInterceptor } from '@/shared/interceptors/timeout.interceptor';
import { JwtUser } from '@/shared/types/jwt-user';
import { Role } from '@/shared/types/role';
import { FindAllUsersQueryDto } from '../dtos/find-all-users.query.dto';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { UserIdParamDto } from '../dtos/user-id.param.dto';
import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly orderHistoryService: OrderHistoryService,
  ) {}

  @ApiOperation({ summary: 'Update my profile', description: 'Updates the caller\'s name, phone number, organization and address.' })
  @Patch('me/profile')
  updateProfile(@AuthUser() authUser: JwtUser, @Body() dto: UpdateUserProfileDto): Promise<User> {
    return this.userService.updateProfile(authUser, dto);
  }

  @ApiOperation({ summary: 'List users', description: 'Returns a page of users, newest first. Support staff only.' })
  @Roles(Role.Support)
  @Get()
  findAll(@Query() query: FindAllUsersQueryDto): Promise<User[]> {
    return this.userService.findAll(query);
  }

  @ApiOperation({ summary: 'Get a user', description: 'Returns one user by id. Support staff only.' })
  @Roles(Role.Support)
  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }

  @ApiOperation({ summary: 'List a user\'s orders', description: 'Returns the last 50 orders of one user. Support staff only.' })
  @Roles(Role.Support)
  @UseInterceptors(new TimeoutInterceptor(10_000)) // History queries can be slow for large accounts
  @Get(':id/orders')
  async findAllOrders(@Param() params: UserIdParamDto, @Res() res: Response): Promise<void> {
    const orders = await this.orderHistoryService.findForUser(params.id);
    res.status(200).json(orders);
  }
}
