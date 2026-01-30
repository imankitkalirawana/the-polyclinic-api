import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { SchemaValidatorService } from '../schema/schema-validator.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getTenantConnection } from 'src/common/db/tenant-connection';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly schemaValidator: SchemaValidatorService,
  ) {}

  private async getConnection() {
    return await getTenantConnection(this.request.schema);
  }

  private async getUserRepository() {
    const connection = await this.getConnection();
    return connection.getRepository(User);
  }

  async checkUserExistsByEmailAndFail(email: string) {
    const userRepository = await this.getUserRepository();
    const user = await userRepository.findOne({
      where: {
        email,
        companies: ArrayContains([this.request.schema]),
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // safely check if the email is not already taken
  async checkEmailIsNotTaken(email: string) {
    const userRepository = await this.getUserRepository();
    const user = await userRepository.findOne({
      where: { email, companies: ArrayContains([this.request.schema]) },
    });
    if (user) {
      throw new ConflictException('Email already taken');
    }
  }

  async create(dto: CreateUserDto) {
    const userRepository = await this.getUserRepository();

    await this.checkEmailIsNotTaken(dto.email);

    const user = userRepository.create(dto);
    await this.updatePassword(user.id, dto.password);
    return user;
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: {
        companies: ArrayContains([this.request.schema]),
      },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, companies: ArrayContains([this.request.schema]) },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: {
        email,
        companies: ArrayContains([this.request.schema]),
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.checkUserExistsByEmailAndFail(dto.email);
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return await this.userRepository.save(user);
  }

  async updatePassword(id: string, password: string) {
    await this.userRepository.update(id, {
      password_digest: await bcrypt.hash(password, 10),
    });
  }
}
