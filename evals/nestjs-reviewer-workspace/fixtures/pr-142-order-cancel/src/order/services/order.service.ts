import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtUser } from '@/shared/types/jwt-user';
import { CancelOrderDto } from '../dtos/cancel-order.dto';
import { Order, OrderStatus } from '../entities/order.entity';

@Injectable()
export class OrderService {
  static readonly CANCELABLE_STATUSES: OrderStatus[] = [OrderStatus.Pending, OrderStatus.Paid];

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findById(authUser: JwtUser, id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id, userId: authUser.id } });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  async cancel(authUser: JwtUser, id: string, dto: CancelOrderDto): Promise<Order> {
    const order = await this.findById(authUser, id);
    if (!OrderService.CANCELABLE_STATUSES.includes(order.status)) {
      throw new ConflictException(`An order in status ${order.status} cannot be canceled`);
    }
    return this.orderRepository.save({ ...order, status: OrderStatus.Canceled, cancelReason: dto.reason ?? null });
  }
}
