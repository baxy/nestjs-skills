import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';
import { UserPasswordHasher } from './user-password-hasher';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userPasswordHasher: UserPasswordHasher,
  ) {}

  // Not scoped to a caller: other modules look users up by id
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    return this.userRepository.save(await this._toEntity(dto));
  }

  private async _toEntity(dto: CreateUserDto): Promise<User> {
    const { password, ...fields } = dto;
    return this.userRepository.create({ ...fields, passwordHash: await this.userPasswordHasher.hash(password) });
  }
}
