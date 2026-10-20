import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';

@Injectable()
export class OrderHistoryService {
  private readonly logger = new Logger(OrderHistoryService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  // Called by the support listing in the user module — newest first
  async findForUser(userId: string): Promise<Order[]> {
    const orders = await this.orderRepository.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    for (const order of orders) {
      order.items = await this.orderItemRepository.find({ where: { orderId: order.id } });
    }
    this.logger.log(`Loaded ${orders.length} orders for user ${userId}`);
    return orders;
  }
}
