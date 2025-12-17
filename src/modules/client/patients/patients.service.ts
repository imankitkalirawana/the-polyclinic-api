import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { BaseTenantService } from '../../tenancy/base-tenant.service';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';

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
    });

    if (existingPatient) {
      throw new ConflictException(
        'Patient record already exists for this user',
      );
    }

    const patient = patientRepository.create({
      userId: createPatientDto.userId,
      gender: createPatientDto.gender,
      age: createPatientDto.age,
      address: createPatientDto.address,
    });

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

    return {
      message: 'Patient created successfully',
      data: patientWithUser,
    };
  }

  async findAll() {
    await this.ensureTablesExist();
    const patientRepository = this.getPatientRepository();
    return patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.user', 'user')
      .select([...patientSelect, ...userSelect])
      .getRawMany();
  }

  async findOne(id: string) {
    await this.ensureTablesExist();
    const patientRepository = this.getPatientRepository();

    const patient = await patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.user', 'user')
      .select([...patientSelect, ...userSelect])
      .getRawOne();

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return patient;
  }

  async findByUserId(userId: string) {
    await this.ensureTablesExist();
    const patientRepository = this.getPatientRepository();

    const patient = await patientRepository
      .createQueryBuilder('patient')
      .leftJoin('patient.user', 'user')
      .select([...patientSelect, ...userSelect])
      .where('patient.userId = :userId', { userId })
      .getRawOne();

    if (!patient) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }

    return patient;
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

    return {
      message: 'Patient updated successfully',
      data: patientWithUser,
    };
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

    return {
      message: 'Patient deleted successfully',
    };
  }
}
