import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private initializedTenants = new Set<string>();

  constructor(
    @Inject(REQUEST) private request: Request,
    @Inject(CONNECTION) private connection: DataSource | null,
    private tenantAuthInitService: TenantAuthInitService,
  ) {}

  private getTenantSlug(): string {
    const tenantSlug = (this.request as any).tenantSlug;
    if (!tenantSlug) {
      throw new UnauthorizedException('Tenant slug is required');
    }
    return tenantSlug;
  }

  /**
   * Ensure auth tables exist for the current tenant
   */
  private async ensureTablesExist(): Promise<void> {
    const tenantSlug = this.getTenantSlug();

    if (this.initializedTenants.has(tenantSlug)) {
      return;
    }

    try {
      await this.tenantAuthInitService.ensureTenantAuthTables(tenantSlug);
      this.initializedTenants.add(tenantSlug);
    } catch (error) {
      this.logger.error(
        `Failed to ensure tables for tenant ${tenantSlug}:`,
        error,
      );
    }
  }

  private getUserRepository(): Repository<TenantUser> {
    if (!this.connection) {
      throw new UnauthorizedException('Tenant connection not available');
    }
    return this.connection.getRepository(TenantUser);
  }

  async create(
    createUserDto: CreateUserDto,
  ): Promise<Omit<TenantUser, 'password'>> {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    // Check if user with email already exists
    const existingUser = await userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      name: createUserDto.name,
      role: createUserDto.role,
      status: createUserDto.status,
      phone: createUserDto.phone,
      image: createUserDto.image,
    });

    const savedUser = await userRepository.save(user);

    // Remove password from response
    delete savedUser.password;

    return savedUser;
  }

  async findAll(): Promise<Omit<TenantUser, 'password'>[]> {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const users = await userRepository.find();

    // Remove passwords from response
    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async findOne(id: string): Promise<Omit<TenantUser, 'password'>> {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<TenantUser, 'password'>> {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email is being updated and if it's already taken
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Hash password if provided
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await userRepository.save(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async remove(id: string): Promise<void> {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await userRepository.remove(user);
  }
}
