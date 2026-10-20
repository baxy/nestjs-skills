import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { Product } from '@/product/entities/product.entity';

const FEATURED_PRODUCTS_KEY = 'catalog:featured';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findFeatured(): Promise<Product[]> {
    const cached = await this.cache.get<Product[]>(FEATURED_PRODUCTS_KEY);
    if (cached) {
      return cached;
    }
    const products = await this.productRepository.find({ where: { featured: true }, take: 20 });
    await this.cache.set(FEATURED_PRODUCTS_KEY, products, 10 * 60_000);
    return products;
  }
}
