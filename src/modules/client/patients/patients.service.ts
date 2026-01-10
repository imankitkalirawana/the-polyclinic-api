import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { DataSource, ILike } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { BaseTenantService } from '../../tenancy/base-tenant.service';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { formatPatient } from './patients.helper';
import { CreateUserDto } from '../users/dto/create-user.dto';

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

  async create(createPatientDto: CreateUserDto) {
    if (!createPatientDto.userId) {
      throw new BadRequestException('User ID is required to create a patient');
    }
    return await this.getPatientRepository().save(createPatientDto);
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

  async update(userId: string, updatePatientDto: UpdatePatientDto) {
    const patientRepository = this.getPatientRepository();
    const patient = await patientRepository.findOne({
      where: { userId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with user ID ${userId} not found`);
    }
    Object.assign(patient, updatePatientDto);
    return await patientRepository.save(patient);
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
