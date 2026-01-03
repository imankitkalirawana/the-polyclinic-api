import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { DataSource, ILike } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { BaseTenantService } from '../../tenancy/base-tenant.service';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { Role } from 'src/common/enums/role.enum';
import {
  areNamesSimilar,
  formatPatient,
  generatePassword,
} from './patients.helper';
import * as bcrypt from 'bcryptjs';

const patientSelect = [
  'patient.id AS id',
  'patient.gender AS gender',
  'patient.age AS age',
  'patient.address AS address',
];

const userSelect = [
  'user.id AS userId',
  'user.email AS email',
  'user.name AS name',
  'user.image AS image',
  'user.phone AS phone',
];

@Injectable()
export class PatientsService extends BaseTenantService {
  constructor(
    @Inject(REQUEST) request: Request,
    @Inject(CONNECTION) connection: DataSource | null,
    tenantAuthInitService: TenantAuthInitService,
  ) {
    super(request, connection, tenantAuthInitService, PatientsService.name);
  }

  private getPatientRepository() {
    return this.getRepository(Patient);
  }

  private getUserRepository() {
    return this.getRepository(TenantUser);
  }

  async create(createPatientDto: CreatePatientDto) {
    await this.ensureTablesExist();
    const patientRepository = this.getPatientRepository();
    const userRepository = this.getUserRepository();

    // If userId is not provided, create a new user
    if (!createPatientDto?.userId) {
      // if email is not provided, then consider phone as email with @example.com domain
      if (!createPatientDto.email) {
        createPatientDto.email = `${createPatientDto.phone}@example.com`;
      }

      // now check if user exists with this email
      const user = await userRepository.findOne({
        where: { email: createPatientDto.email },
      });
      if (user) {
        const password = await bcrypt.hash(generatePassword(), 10);

        if (areNamesSimilar(createPatientDto.name, user.name)) {
          createPatientDto.userId = user.id;
        } else {
          const email = `${createPatientDto.email.split('@')[0]}+${Math.random().toString(36).substring(2, 4)}@${createPatientDto.email.split('@')[1]}`;

          // create a new user with the given name and email+ random 2 digits at the end
          const newUser = userRepository.create({
            ...createPatientDto,
            email,
            password,
          });
          await userRepository.save(newUser);
          createPatientDto.userId = newUser.id;
        }
      } else {
        const password = await bcrypt.hash(generatePassword(), 10);
        const newUser = userRepository.create({
          ...createPatientDto,
          password,
        });
        await userRepository.save(newUser);
        createPatientDto.userId = newUser.id;
      }
    }

    // Check if user exists
    const user = await userRepository.findOne({
      where: { id: createPatientDto.userId },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createPatientDto.userId} not found`,
      );
    }

    // Check if patient already exists for this user
    const existingPatient = await patientRepository.findOne({
      where: { userId: createPatientDto.userId },
      relations: ['user'],
    });

    if (existingPatient) {
      throw new ConflictException(
        `Patient record already exists for "${existingPatient.user.name}"`,
      );
    }

    const patient = patientRepository.create(createPatientDto);

    if (user.role !== Role.PATIENT) {
      user.role = Role.PATIENT;
      await userRepository.save(user);
    }

    const savedPatient = await patientRepository.save(patient);

    // Load user relation
    const patientWithUser = await patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.user', 'user')
      .select([...patientSelect, ...userSelect])
      .where('patient.id = :id', { id: savedPatient.id })
      .getRawOne();

    if (!patientWithUser) {
      throw new NotFoundException('Failed to retrieve created patient');
    }

    return patientWithUser;
  }

  async findAll(search?: string) {
    await this.ensureTablesExist();
    const patients = await this.getRepository(Patient).find({
      where: search
        ? [
            { user: { name: ILike(`%${search}%`) } },
            { user: { email: ILike(`%${search}%`) } },
            { user: { phone: ILike(`%${search}%`) } },
          ]
        : {},
      relations: ['user'],
      order: {
        user: { name: 'ASC' },
      },
      take: 30,
    });

    return patients.map(formatPatient);
  }

  async findByUserId(userId: string) {
    await this.ensureTablesExist();

    const patient = await this.getRepository(Patient).findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }

    return formatPatient(patient);
  }

  async findOne(id: string) {
    await this.ensureTablesExist();
    const patient = await this.getRepository(Patient).findOne({
      where: { id },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return formatPatient(patient);
  }

  async update(id: string, updatePatientDto: UpdatePatientDto) {
    await this.ensureTablesExist();
    const patientRepository = this.getPatientRepository();

    const patient = await patientRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // If tenantUserId is being updated, check if the new user exists
    if (updatePatientDto.userId) {
      const userRepository = this.getUserRepository();
      const user = await userRepository.findOne({
        where: { id: updatePatientDto.userId },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${updatePatientDto.userId} not found`,
        );
      }

      // Check if another patient already exists for this user
      const existingPatient = await patientRepository.findOne({
        where: { userId: updatePatientDto.userId },
      });

      if (existingPatient && existingPatient.id !== id) {
        throw new ConflictException(
          'Another patient record already exists for this user',
        );
      }
    }

    Object.assign(patient, updatePatientDto);
    const updatedPatient = await patientRepository.save(patient);

    const patientWithUser = await patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.user', 'user')
      .select([...patientSelect, ...userSelect])
      .where('patient.id = :id', { id: updatedPatient.id })
      .getRawOne();

    if (!patientWithUser) {
      throw new NotFoundException('Failed to retrieve updated patient');
    }

    return patientWithUser;
  }

  async remove(id: string) {
    await this.ensureTablesExist();
    const patientRepository = this.getPatientRepository();

    const patient = await patientRepository.findOne({
      where: { id },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    await patientRepository.remove(patient);

    return null;
  }
}
