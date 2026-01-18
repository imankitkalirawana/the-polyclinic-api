import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Patient } from './entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { UserTenant } from '../users/entities/user-tenant.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { formatPatient } from './patients.helper';
import { Role } from 'src/common/enums/role.enum';
import { Status } from 'src/common/enums/status.enum';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserTenant)
    private userTenantRepository: Repository<UserTenant>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @Inject(REQUEST) private request: Request,
  ) {}

  private getTenantSlug(): string | null {
    return (this.request as any).tenantSlug || null;
  }

  async create(createPatientDto: CreatePatientDto) {
    let user: User;

    if (createPatientDto.userId) {
      // Use existing user
      const existingUser = await this.userRepository.findOne({
        where: { id: createPatientDto.userId },
      });
      if (!existingUser) {
        throw new NotFoundException(
          `User with ID ${createPatientDto.userId} not found`,
        );
      }
      user = existingUser;

      // Check if patient already exists for this user
      const existingPatient = await this.patientRepository.findOne({
        where: { userId: user.id },
      });
      if (existingPatient) {
        throw new BadRequestException(
          'Patient profile already exists for this user',
        );
      }
    } else {
      // Create new user
      if (!createPatientDto.name) {
        throw new BadRequestException('Name is required to create a new user');
      }

      const password = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);

      user = this.userRepository.create({
        email: createPatientDto.email || `patient-${uuidv4()}@temp.local`,
        password: hashedPassword,
        name: createPatientDto.name,
        role: Role.PATIENT,
        status: Status.ACTIVE,
        phone: createPatientDto.phone,
        image: createPatientDto.image,
      });

      user = await this.userRepository.save(user);
    }

    // Add user to tenant if tenant context exists
    const tenantSlug = this.getTenantSlug();
    if (tenantSlug) {
      const tenant = await this.tenantRepository.findOne({
        where: { slug: tenantSlug },
      });
      if (tenant) {
        const existingRelation = await this.userTenantRepository.findOne({
          where: { userId: user.id, tenantId: tenant.id },
        });
        if (!existingRelation) {
          const userTenant = this.userTenantRepository.create({
            userId: user.id,
            tenantId: tenant.id,
          });
          await this.userTenantRepository.save(userTenant);
        }
      }
    }

    // Create patient profile
    const patient = this.patientRepository.create({
      userId: user.id,
      gender: createPatientDto.gender,
      age: createPatientDto.age,
      address: createPatientDto.address,
    });

    const savedPatient = await this.patientRepository.save(patient);

    // Return with user relation
    return this.patientRepository.findOne({
      where: { id: savedPatient.id },
      relations: ['user'],
    });
  }

  async findAll(search?: string, tenantSlug?: string) {
    const queryBuilder = this.patientRepository
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.user', 'user')
      .where('user.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filter by tenant if provided or from request context
    const slug = tenantSlug || this.getTenantSlug();
    if (slug) {
      const tenant = await this.tenantRepository.findOne({
        where: { slug },
      });
      if (tenant) {
        queryBuilder
          .innerJoin('user.userTenants', 'ut')
          .andWhere('ut.tenantId = :tenantId', { tenantId: tenant.id });
      }
    }

    const patients = await queryBuilder
      .orderBy('user.name', 'ASC')
      .take(30)
      .getMany();

    return patients.map(formatPatient);
  }

  async findByUserId(userId: string) {
    const patient = await this.patientRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }

    return patient;
  }

  async findOne(id: string) {
    const patient = await this.patientRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return patient;
  }

  async update(userId: string, updatePatientDto: UpdatePatientDto) {
    const patient = await this.patientRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }

    // Update patient fields
    if (updatePatientDto.gender !== undefined) {
      patient.gender = updatePatientDto.gender;
    }
    if (updatePatientDto.age !== undefined) {
      patient.age = updatePatientDto.age;
    }
    if (updatePatientDto.address !== undefined) {
      patient.address = updatePatientDto.address;
    }

    await this.patientRepository.save(patient);

    // Update user fields if provided
    if (
      updatePatientDto.name ||
      updatePatientDto.email ||
      updatePatientDto.phone ||
      updatePatientDto.image
    ) {
      const user = patient.user;
      if (updatePatientDto.name) user.name = updatePatientDto.name;
      if (updatePatientDto.email) user.email = updatePatientDto.email;
      if (updatePatientDto.phone) user.phone = updatePatientDto.phone;
      if (updatePatientDto.image) user.image = updatePatientDto.image;
      await this.userRepository.save(user);
    }

    return this.patientRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async remove(userId: string) {
    const patient = await this.patientRepository.findOne({
      where: { userId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }

    await this.patientRepository.softDelete({ userId });
  }

  async restore(userId: string) {
    const exists = await this.patientRepository.exists({
      where: { userId },
      withDeleted: true,
    });

    if (!exists) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }

    await this.patientRepository.restore({ userId });
  }
}
