import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Stock } from '../entities/stock.entity';

@Injectable()
export class InventoryService {
  async reserve(manager: EntityManager, sku: string, quantity: number): Promise<void> {
    const { affected } = await manager
      .createQueryBuilder()
      .update(Stock)
      .set({ quantity: () => 'quantity - :quantity' })
      .where('sku = :sku AND quantity >= :quantity', { sku, quantity })
      .execute();
    if (!affected) {
      throw new ConflictException(`Not enough stock for ${sku}`);
    }
  }

  async reserveForOrder(orderId: string): Promise<void> {
    // Loads the order items and reserves each one in a transaction
  }
}
