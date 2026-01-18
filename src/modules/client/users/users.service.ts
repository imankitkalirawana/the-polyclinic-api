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
import { TenantUser } from './entities/tenant-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { v4 as uuidv4 } from 'uuid';
import { formatUser } from './users.helper';

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

  async create(createUserDto: CreateUserDto) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const existingUser = await userRepository.findOne({
      where: { email: createUserDto.email },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const password = createUserDto.password || uuidv4();

    const hashedPassword = await bcrypt.hash(password, 10);

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

    delete savedUser.password;

    return savedUser;
  }

  async findAll() {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const users = await userRepository.find();

    return users.map((user) => formatUser(user, this.request.user.role));
  }

  async findOne(id: string) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  // reset password (admin can reset password for any user)
  async resetPassword(id: string, password: string) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new UnauthorizedException('User with this ID does not exist');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await userRepository.save(user);

    return { message: 'Password reset successfully' };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    Object.assign(user, updateUserDto);
    const updatedUser = await userRepository.save(user);
    delete updatedUser.password;
    return updatedUser;
  }

  async remove(id: string) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await userRepository.delete(id);
  }

  async softRemove(id: string) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await userRepository.softRemove(user);
  }

  async restore(id: string) {
    await this.ensureTablesExist();
    const userRepository = this.getUserRepository();

    const user = await userRepository.exists({
      where: { id },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await userRepository.restore(id);
  }
}
