import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { getTenantConnection } from 'src/common/db/tenant-connection';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class UsersService {
  private readonly schema: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(REQUEST) private request: Request,
  ) {
    this.schema = this.request.schema;
  }

  private async getConnection() {
    return await getTenantConnection(this.schema);
  }

  private async getUserRepository() {
    const connection = await this.getConnection();
    return connection.getRepository(User);
  }

  async checkUserExistsByEmail(email: string) {
    const userRepository = await this.getUserRepository();
    const user = await userRepository.findOne({
      where: {
        email,
        companies: ArrayContains([this.schema]),
      },
    });
    return user;
  }

  async checkUserExistsByEmailAndFail(email: string) {
    const userRepository = await this.getUserRepository();
    const user = await userRepository.findOne({
      where: {
        email,
        companies: ArrayContains([this.schema]),
      },
    });
    if (!user) {
      throw new NotFoundException(
        'User not found with email: ' + email,
        'schema: ' + this.schema,
      );
    }
    return user;
  }

  async checkUserExistsByIdAndFail(id: string) {
    const userRepository = await this.getUserRepository();
    const user = await userRepository.findOne({
      where: { id, companies: ArrayContains([this.schema]) },
    });
    if (!user) {
      throw new NotFoundException('User not found with id: ' + id);
    }
  }

  // safely check if the email is not already taken in this company
  async checkEmailIsNotTaken(email: string) {
    const userRepository = await this.getUserRepository();
    const user = await userRepository.findOne({
      where: {
        email,
        companies: ArrayContains([this.schema]),
      },
    });
    if (user) {
      throw new ConflictException('Email already taken');
    }
    return true;
  }

  // find user by email in the shared users table (any company)
  private async findUserByEmailGlobally(email: string): Promise<User | null> {
    const userRepository = await this.getUserRepository();
    return userRepository.findOne({
      where: { email },
      withDeleted: true,
    });
  }

  async create(dto: CreateUserDto) {
    const userRepository = await this.getUserRepository();
    const existingUser = await this.findUserByEmailGlobally(dto.email);

    if (existingUser?.companies?.includes(this.schema)) {
      throw new ConflictException('User already exists in this company');
    }

    if (existingUser) {
      await this.addUserToCompany(dto.email, this.schema);
      if (existingUser.deletedAt) {
        await this.restore(existingUser.id);
      }

      return existingUser;
    }
    const user = userRepository.create({
      ...dto,
      password_digest: dto.password
        ? await bcrypt.hash(dto.password, 10)
        : undefined,
      companies: [this.schema],
    });
    return await userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: {
        companies: ArrayContains([this.schema]),
      },
    });
  }

  async addUserToCompany(email: string, schema: string) {
    const user = await this.findUserByEmailGlobally(email);
    const companies = [...new Set([...(user.companies || []), schema])];
    await this.userRepository.update(user.id, { companies });
    return user;
  }

  async removeUserFromCompany(email: string, schema: string) {
    const user = await this.findOneByEmail(email);
    const companies = user.companies.filter((c) => c !== schema);
    await this.userRepository.update(user.id, { companies });
    return user;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, companies: ArrayContains([this.schema]) },
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
        companies: ArrayContains([this.schema]),
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
    await this.checkUserExistsByIdAndFail(id);
    const userRepository = await this.getUserRepository();
    await userRepository.update(id, {
      password_digest: await bcrypt.hash(password, 10),
    });
  }

  async softDelete(id: string) {
    const userRepository = await this.getUserRepository();
    await userRepository.softDelete(id);
  }

  async restore(id: string) {
    const userRepository = await this.getUserRepository();
    await userRepository.restore(id);
  }
}
