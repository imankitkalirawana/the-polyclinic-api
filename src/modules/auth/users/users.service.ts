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
import { CompanyType } from '../entities/company.entity';
import { Role } from 'src/common/enums/role.enum';
import {
  assertRoleAllowedForCompanyType,
  defaultRoleForCompanyType,
  inferCompanyTypeForRole,
} from '../utils/company-role.util';
import { SchemaValidatorService } from '../schema/schema-validator.service';
import { getNameFromEmail, generatePassword } from '@/auth/users/users.utils';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly schemaValidator: SchemaValidatorService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const company_type =
      dto.company_type ??
      (dto.role
        ? inferCompanyTypeForRole(dto.role)
        : CompanyType.THE_POLYCLINIC);
    const role = dto.role ?? defaultRoleForCompanyType(company_type);
    assertRoleAllowedForCompanyType(role, company_type);

    const tenantSlug = this.request.tenantSlug?.toLowerCase();
    const companies = await this.normalizeCompanies([
      ...(dto.companies ?? []),
      ...(tenantSlug ? [tenantSlug] : []),
    ]);

    const password_digest = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email.trim().toLowerCase(),
      name: dto.name,
      phone: dto.phone ?? null,
      password_digest,
      role,
      company_type,
      time_zone: dto.time_zone ?? 'UTC',
      email_verified: false,
      deleted: false,
      permissions: {},
      companies,
    });

    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: {
        deleted: false,
        companies: ArrayContains([this.request.tenantSlug]),
      },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, deleted: false },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneByEmail(email: string): Promise<User> {
    const tenantSlug = this.request.tenantSlug?.toLowerCase();
    if (!tenantSlug) {
      throw new NotFoundException('Tenant schema not available');
    }
    const user = await this.userRepository.findOne({
      where: {
        email: email.trim().toLowerCase(),
        deleted: false,
        companies: ArrayContains([tenantSlug]),
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneByEmailOrId(emailOrId: string): Promise<User> {
    const value = emailOrId.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: [
        { email: value, deleted: false },
        { id: emailOrId, deleted: false },
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneOrCreateByEmail({
    email,
    name = getNameFromEmail(email),
    phone,
    password = generatePassword(12),
    role = Role.PATIENT,
  }: {
    email: string;
    name?: string;
    phone?: string;
    password?: string;
    role?: Role;
  }): Promise<User> {
    const tenantSlug = this.request.tenantSlug?.toLowerCase();
    if (!tenantSlug) {
      throw new NotFoundException('Tenant schema not available');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
        deleted: false,
        companies: ArrayContains([tenantSlug]),
      },
    });

    if (!existing) {
      return await this.create({
        email: normalizedEmail,
        password,
        role,
        name,
        phone,
        companies: [tenantSlug],
      });
    }

    // Ensure this user can access current tenant
    const nextCompanies = await this.normalizeCompanies([
      ...(existing.companies ?? []),
      tenantSlug,
    ]);
    const currentCompanies = existing.companies ?? [];
    const needsUpdate =
      currentCompanies.length !== nextCompanies.length ||
      currentCompanies.some((c, i) => c !== nextCompanies[i]);
    if (needsUpdate) {
      existing.companies = nextCompanies;
      return await this.userRepository.save(existing);
    }

    return existing;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    const nextCompanyType = dto.company_type ?? user.company_type;
    const nextRole = dto.role ?? user.role;
    assertRoleAllowedForCompanyType(
      nextRole as Role,
      nextCompanyType as CompanyType,
    );

    if (dto.password) {
      user.password_digest = await bcrypt.hash(dto.password, 10);
    }
    if (dto.email) user.email = dto.email;
    if (dto.name) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.role) user.role = dto.role;
    if (dto.company_type) user.company_type = dto.company_type;
    if (dto.time_zone) user.time_zone = dto.time_zone;
    if (dto.companies) {
      user.companies = await this.normalizeCompanies(dto.companies);
    }

    return await this.userRepository.save(user);
  }

  async softRemove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.deleted = true;
    await this.userRepository.save(user);
  }

  private async normalizeCompanies(values: string[]): Promise<string[]> {
    const normalized = values
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    const unique = [...new Set(normalized)];
    for (const schema of unique) {
      // validate format and existence (production-safe)
      await this.schemaValidator.assertSchemaExists(schema);
    }
    return unique;
  }
}
