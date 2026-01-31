import {
  Injectable,
  NotFoundException,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { ArrayContains, Repository } from 'typeorm';
import { formatPatient } from './patients.helper';
import { CreatePatientDto } from './dto/create-patient.dto';
import { getTenantConnection } from 'src/common/db/tenant-connection';
import { subYears } from 'date-fns';
import { UsersService } from '@/auth/users/users.service';
import { Patient } from '@/public/patients/entities/patient.entity';

import {
  ClinicalRecord,
  ClinicalRecordType,
} from '@/public/clinical/entities/clinical-record.entity';

@Injectable()
export class PatientsService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly usersService: UsersService,
  ) {}

  private getTenantSlug(): string {
    const schema = this.request.schema;
    if (!schema) {
      throw new NotFoundException('Schema not available');
    }
    return schema;
  }

  private async getConnection() {
    return await getTenantConnection(this.getTenantSlug());
  }

  private async getPatientRepository(): Promise<Repository<Patient>> {
    const connection = await this.getConnection();
    return connection.getRepository(Patient);
  }

  private async getClinicalRecordRepository(): Promise<
    Repository<ClinicalRecord>
  > {
    const connection = await this.getConnection();
    return connection.getRepository(ClinicalRecord);
  }

  private getActor() {
    const actor = this.request?.user;
    return {
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
    };
  }

  private calculateDob(age: number): Date {
    const currentDate = new Date();
    const dob = subYears(currentDate, age);
    return dob;
  }

  private async findPatientEntityByUserId(userId: string) {
    const repo = await this.getPatientRepository();
    return await repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });
  }

  async getClinicalRecords(patientId: string) {
    const repo = await this.getClinicalRecordRepository();

    const qb = repo
      .createQueryBuilder('record')
      .where('record.patient_id = :patientId', { patientId })
      .orderBy('record.occurred_at', 'DESC')
      .take(100);

    const records = await qb.getMany();
    return records.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      sourceTenantSlug: r.sourceTenantSlug,
      encounterRef: r.encounterRef,
      occurredAt: r.occurredAt,
      recordType: r.recordType as ClinicalRecordType,
      payload: r.payload ?? {},
      amendedRecordId: r.amendedRecordId ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async checkPatientExists(patientId: string, earlyReturn?: boolean) {
    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.findOne({
      where: {
        id: patientId,
        user: {
          companies: ArrayContains([this.getTenantSlug()]),
        },
      },
    });

    if (earlyReturn && !patient) {
      throw new NotFoundException('Patient not found');
    }

    return {
      exists: !!patient,
      patient,
    };
  }

  async checkPatientExistsByEmail(email: string, earlyReturn?: boolean) {
    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.findOne({
      where: {
        user: {
          email,
          companies: ArrayContains([this.getTenantSlug()]),
        },
      },
    });

    if (earlyReturn && patient) {
      throw new ConflictException('Patient with this email already exists');
    }

    return {
      exists: !!patient,
      patient,
    };
  }

  async create(createPatientDto: CreatePatientDto) {
    await this.checkPatientExistsByEmail(createPatientDto.email, true);

    const user = await this.usersService.findOneByEmail(createPatientDto.email);

    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.save({
      user_id: user.id,
      gender: createPatientDto.gender,
      dob: createPatientDto.dob,
      address: createPatientDto.address,
    });

    return patient;
  }

  async findAll(_search?: string) {}

  async findByUserId(userId: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return formatPatient(patient);
  }

  async findOne(id: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { id, user: { companies: ArrayContains([this.getTenantSlug()]) } },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return formatPatient(patient);
  }

  async remove(_patientId: string) {}

  async restore(_patientId: string) {}
}
