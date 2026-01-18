import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entities/user.entity';
import { UserTenant } from './entities/user-tenant.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Role } from 'src/common/enums/role.enum';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserTenant)
    private userTenantRepository: Repository<UserTenant>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const password = createUserDto.password || uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      name: createUserDto.name,
      role: createUserDto.role || Role.PATIENT,
      status: createUserDto.status,
      phone: createUserDto.phone,
      image: createUserDto.image,
    });

    const savedUser = await this.userRepository.save(user);
    const { password: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword as Omit<User, 'password'>;
  }

  async findAll(queryDto: QueryUserDto): Promise<Omit<User, 'password'>[]> {
    const { search, tenantId } = queryDto;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where(
        '(user.email ILIKE :search OR user.name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (tenantId) {
      queryBuilder
        .innerJoin('user.userTenants', 'ut')
        .andWhere('ut.tenantId = :tenantId', { tenantId });
    }

    const users = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async findOne(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['userTenants', 'userTenants.tenant'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.remove(user);
  }

  async softRemove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.softRemove(user);
  }

  async restore(id: string): Promise<void> {
    const exists = await this.userRepository.exists({
      where: { id },
      withDeleted: true,
    });

    if (!exists) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.restore(id);
  }

  // User-Tenant relationship methods
  async addUserToTenant(userId: string, tenantId: string): Promise<UserTenant> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const existingRelation = await this.userTenantRepository.findOne({
      where: { userId, tenantId },
    });

    if (existingRelation) {
      return existingRelation;
    }

    const userTenant = this.userTenantRepository.create({
      userId,
      tenantId,
    });

    return this.userTenantRepository.save(userTenant);
  }

  async addUserToTenantBySlug(
    userId: string,
    tenantSlug: string,
  ): Promise<UserTenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${tenantSlug} not found`);
    }

    return this.addUserToTenant(userId, tenant.id);
  }

  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    const result = await this.userTenantRepository.delete({ userId, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException(
        `User-tenant relationship not found for user ${userId} and tenant ${tenantId}`,
      );
    }
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const userTenants = await this.userTenantRepository.find({
      where: { userId },
      relations: ['tenant'],
    });

    return userTenants.map((ut) => ut.tenant);
  }

  async isUserInTenant(userId: string, tenantId: string): Promise<boolean> {
    return this.userTenantRepository.exists({
      where: { userId, tenantId },
    });
  }

  async isUserInTenantBySlug(
    userId: string,
    tenantSlug: string,
  ): Promise<boolean> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      return false;
    }
    return this.isUserInTenant(userId, tenant.id);
  }

  async findUsersByTenant(tenantId: string): Promise<Omit<User, 'password'>[]> {
    const userTenants = await this.userTenantRepository.find({
      where: { tenantId },
      relations: ['user'],
    });

    return userTenants.map((ut) => {
      const { password, ...userWithoutPassword } = ut.user;
      return userWithoutPassword;
    });
  }

  async findUsersByTenantSlug(
    tenantSlug: string,
    search?: string,
  ): Promise<Omit<User, 'password'>[]> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${tenantSlug} not found`);
    }

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userTenants', 'ut')
      .where('ut.tenantId = :tenantId', { tenantId: tenant.id });

    if (search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const users = await queryBuilder.orderBy('user.name', 'ASC').getMany();

    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }
}
