import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Address } from '@/shared/types/address';
import { User } from '@/user/entities/user.entity';

export enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Shipped = 'shipped',
  Canceled = 'canceled',
}

@Entity('orders')
@Index('IDX_orders_user_id_status', ['userId', 'status'])
@Check('CHK_orders_total_non_negative', '"total" >= 0')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', default: OrderStatus.Pending })
  status: OrderStatus;

  @Column({ type: 'integer' })
  total: number; // Minor units (cents)

  @Column({ type: 'jsonb' })
  shippingAddress: Address;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiHideProperty()
  @Exclude()
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
