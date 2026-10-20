import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderCreatedEvent } from '@/order/events/order-created.event';
import { InventoryService } from '../services/inventory.service';

@Injectable()
export class OrderCreatedListener {
  constructor(private readonly inventoryService: InventoryService) {}

  @OnEvent('order.created', { async: true })
  async handle(event: OrderCreatedEvent): Promise<void> {
    await this.inventoryService.reserveForOrder(event.orderId);
  }
}
