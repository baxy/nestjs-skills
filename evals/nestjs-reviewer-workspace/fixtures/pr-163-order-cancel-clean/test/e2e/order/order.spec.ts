import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { OrderController } from '@/order/controllers/order.controller';
import { Order, OrderStatus } from '@/order/entities/order.entity';
import { OrderService } from '@/order/services/order.service';
import { JwtUser } from '@/shared/types/jwt-user';
import { Role } from '@/shared/types/role';
import { createTestApp } from '../../helpers/create-test-app';
import { testAuthGuard } from '../../helpers/test-auth.guard';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ORDER_ID = '00000000-0000-4000-8000-000000000002';
const AUTH_USER: JwtUser = { id: USER_ID, email: 'jane@example.com', roles: [Role.User] };

describe('Orders', () => {
  let app: INestApplication;
  const orderRepository = { findOne: jest.fn(), save: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: APP_GUARD, useValue: testAuthGuard(() => AUTH_USER) },
      ],
    }).compile();
    app = await createTestApp(moduleRef);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('POST /orders/:id/cancel', () => {
    it('cancels a pending order', async () => {
      orderRepository.findOne.mockResolvedValue({ id: ORDER_ID, userId: USER_ID, status: OrderStatus.Pending });
      orderRepository.save.mockImplementation(async (value) => value);

      const res = await request(app.getHttpServer()).post(`/orders/${ORDER_ID}/cancel`).send({ reason: 'Ordered by mistake' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: ORDER_ID, status: OrderStatus.Canceled });
      expect(orderRepository.findOne).toHaveBeenCalledWith({ where: { id: ORDER_ID, userId: USER_ID } });
    });

    it('rejects canceling a shipped order', async () => {
      orderRepository.findOne.mockResolvedValue({ id: ORDER_ID, userId: USER_ID, status: OrderStatus.Shipped });

      const res = await request(app.getHttpServer()).post(`/orders/${ORDER_ID}/cancel`).send({});

      expect(res.status).toBe(400);
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('returns 404 for another user\'s order', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).post(`/orders/${ORDER_ID}/cancel`).send({});

      expect(res.status).toBe(404);
    });
  });
});
