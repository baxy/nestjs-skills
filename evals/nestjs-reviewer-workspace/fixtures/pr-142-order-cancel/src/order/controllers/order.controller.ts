import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@/shared/decorators/auth-user.decorator';
import { JwtUser } from '@/shared/types/jwt-user';
import { CancelOrderDto } from '../dtos/cancel-order.dto';
import { OrderIdParamDto } from '../dtos/order-id.param.dto';
import { Order } from '../entities/order.entity';
import { OrderService } from '../services/order.service';

@ApiTags('Orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Cancel an order', description: 'Cancels a pending or paid order of the caller.' })
  @Post(':id/cancel')
  cancel(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto, @Body() dto: CancelOrderDto): Promise<Order> {
    return this.orderService.cancel(authUser, params.id, dto);
  }
}
