import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtUser } from '@/shared/types/jwt-user';
import { FindAllUsersQueryDto } from '../dtos/find-all-users.query.dto';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Support staff look users up by id; no caller scopes this lookup
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async findAll(query: FindAllUsersQueryDto): Promise<User[]> {
    const qb = this.userRepository.createQueryBuilder('user');
    if (query.search) {
      qb.where('user.name ILIKE :search OR user.email ILIKE :search', { search: `${query.search}%` });
    }
    return qb.orderBy('user.createdAt', 'DESC').skip(query.offset).take(query.limit).getMany();
  }

  async updateProfile(authUser: JwtUser, dto: UpdateUserProfileDto): Promise<User> {
    const user = await this.findById(authUser.id);
    const phoneNumber = dto.phoneNumber ? this.normalizePhone(dto.phoneNumber) : user.phoneNumber;
    return this.userRepository.save({ ...user, ...dto, phoneNumber });
  }

  private normalizePhone(phoneNumber: string): string {
    return phoneNumber.replace(/[\s-]/g, '');
  }
}
