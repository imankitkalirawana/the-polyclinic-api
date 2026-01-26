import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Repository } from 'typeorm';
import { formatPatient } from './patients.helper';
import { CreatePatientDto } from './dto/create-patient.dto';
import { getTenantConnection } from 'src/common/db/tenant-connection';
import { subYears } from 'date-fns';
import { UsersService } from '@/auth/users/users.service';
import { Role } from 'src/common/enums/role.enum';
import { Patient } from '@/public/patients/entities/patient.entity';
import {
  PatientTenantMembership,
  PatientTenantMembershipStatus,
} from '@/public/patients/entities/patient-tenant-membership.entity';
import {
  ClinicalRecord,
  ClinicalRecordType,
} from '@/public/clinical/entities/clinical-record.entity';
import {
  PatientMembershipAuditAction,
  PatientMembershipAuditLog,
} from '@/public/patients/entities/patient-membership-audit.entity';

@Injectable()
export class PatientsService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly usersService: UsersService,
  ) {}

  private getTenantSlug(): string {
    const tenantSlug = this.request.tenantSlug;
    if (!tenantSlug) {
      throw new NotFoundException('Tenant schema not available');
    }
    return tenantSlug;
  }

  private async getConnection() {
    return await getTenantConnection(this.getTenantSlug());
  }

  private async getPatientRepository(): Promise<Repository<Patient>> {
    const connection = await this.getConnection();
    return connection.getRepository(Patient);
  }

  private async getMembershipRepository(): Promise<
    Repository<PatientTenantMembership>
  > {
    const connection = await this.getConnection();
    return connection.getRepository(PatientTenantMembership);
  }

  private async getClinicalRecordRepository(): Promise<
    Repository<ClinicalRecord>
  > {
    const connection = await this.getConnection();
    return connection.getRepository(ClinicalRecord);
  }

  private async getAuditRepository(): Promise<
    Repository<PatientMembershipAuditLog>
  > {
    const connection = await this.getConnection();
    return connection.getRepository(PatientMembershipAuditLog);
  }

  private getActor() {
    const actor = this.request?.user;
    return {
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
    };
  }

  private async auditMembershipChange(args: {
    patientId: string;
    tenantSlug: string;
    action: PatientMembershipAuditAction;
    before?: Record<string, any>;
    after?: Record<string, any>;
  }) {
    const repo = await this.getAuditRepository();
    const { actorUserId, actorRole } = this.getActor();
    await repo.save(
      repo.create({
        patientId: args.patientId,
        tenantSlug: args.tenantSlug,
        action: args.action,
        actorUserId,
        actorRole,
        before: args.before ?? {},
        after: args.after ?? {},
      }),
    );
  }

  private calculateDob(age: number): Date {
    const currentDate = new Date();
    const dob = subYears(currentDate, age);
    return dob;
  }

  private async assertActiveMembership(patientId: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const membershipRepository = await this.getMembershipRepository();
    const membership = await membershipRepository.findOne({
      where: {
        patientId,
        tenantSlug,
        status: PatientTenantMembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      // Avoid leaking existence of patient across tenants
      throw new NotFoundException('Patient not found');
    }
    return membership;
  }

  private async findPatientEntityByUserId(userId: string) {
    const repo = await this.getPatientRepository();
    return await repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });
  }

  async getClinicalRecords(patientId: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const membership = await this.assertActiveMembership(patientId);
    const repo = await this.getClinicalRecordRepository();

    const qb = repo
      .createQueryBuilder('record')
      .where('record.patient_id = :patientId', { patientId })
      .orderBy('record.occurred_at', 'DESC')
      .take(100);

    // Local records always visible while membership is ACTIVE.
    // External records only visible if patient allowed sharing for this tenant.
    if (!membership.shareMedicalHistory) {
      qb.andWhere('record.source_tenant_slug = :tenantSlug', { tenantSlug });
    }

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

  async updateMySharingPreference(
    userId: string,
    shareMedicalHistory: boolean,
  ) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const patient = await this.findPatientEntityByUserId(userId);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const membershipRepository = await this.getMembershipRepository();
    const membership = await membershipRepository.findOne({
      where: {
        patientId: patient.id,
        tenantSlug,
        status: PatientTenantMembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      throw new NotFoundException('Patient not found');
    }

    const before = { shareMedicalHistory: membership.shareMedicalHistory };
    membership.shareMedicalHistory = shareMedicalHistory;
    await membershipRepository.save(membership);
    await this.auditMembershipChange({
      patientId: patient.id,
      tenantSlug,
      action: PatientMembershipAuditAction.SHARING_UPDATED,
      before,
      after: { shareMedicalHistory: membership.shareMedicalHistory },
    });
    return { shareMedicalHistory: membership.shareMedicalHistory };
  }

  async create(createPatientDto: CreatePatientDto) {
    const patientRepository = await this.getPatientRepository();
    const membershipRepository = await this.getMembershipRepository();
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();

    const user = await this.usersService.findOneOrCreateByEmail({
      email: createPatientDto.email,
      name: createPatientDto.name,
      phone: createPatientDto.phone,
      password: createPatientDto.password,
    });

    if (!user) {
      throw new NotFoundException(
        `User with email ${createPatientDto.email} not found`,
      );
    }

    if (user.role !== Role.PATIENT) {
      throw new BadRequestException('User is not a patient');
    }

    let patient = await patientRepository.findOne({
      where: { user_id: user.id },
      relations: ['user'],
    });

    if (!patient) {
      patient = await patientRepository.save({
        user_id: user.id,
        gender: createPatientDto.gender,
        address: createPatientDto.address,
        dob: createPatientDto.age
          ? this.calculateDob(createPatientDto.age)
          : createPatientDto.dob
            ? new Date(createPatientDto.dob)
            : null,
      });
    }

    const existingMembership = await membershipRepository.findOne({
      where: { patientId: patient.id, tenantSlug },
    });

    if (!existingMembership) {
      await membershipRepository.save({
        patientId: patient.id,
        tenantSlug,
        status: PatientTenantMembershipStatus.ACTIVE,
        shareMedicalHistory: true,
      });
      await this.auditMembershipChange({
        patientId: patient.id,
        tenantSlug,
        action: PatientMembershipAuditAction.MEMBERSHIP_CREATED,
        after: {
          status: PatientTenantMembershipStatus.ACTIVE,
          shareMedicalHistory: true,
        },
      });
    } else if (
      existingMembership.status !== PatientTenantMembershipStatus.ACTIVE
    ) {
      const before = {
        status: existingMembership.status,
        shareMedicalHistory: existingMembership.shareMedicalHistory,
      };
      existingMembership.status = PatientTenantMembershipStatus.ACTIVE;
      await membershipRepository.save(existingMembership);
      await this.auditMembershipChange({
        patientId: patient.id,
        tenantSlug,
        action: PatientMembershipAuditAction.MEMBERSHIP_RESTORED,
        before,
        after: {
          status: existingMembership.status,
          shareMedicalHistory: existingMembership.shareMedicalHistory,
        },
      });
    }

    // Ensure tenant-scoped response always respects membership
    await this.assertActiveMembership(patient.id);
    const created = await patientRepository.findOne({
      where: { id: patient.id },
      relations: ['user'],
    });
    return created ? formatPatient(created) : formatPatient(patient);
  }

  async findAll(search?: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const patientRepo = await this.getPatientRepository();

    const qb = patientRepo
      .createQueryBuilder('patient')
      .innerJoin(
        PatientTenantMembership,
        'membership',
        'membership.patient_id = patient.id',
      )
      .innerJoinAndSelect('patient.user', 'user')
      .where('membership.tenant_slug = :tenantSlug', { tenantSlug })
      .andWhere('membership.status = :status', {
        status: PatientTenantMembershipStatus.ACTIVE,
      })
      .orderBy('user.name', 'ASC')
      .take(30);

    if (search?.trim()) {
      qb.andWhere(
        '(user.name ILIKE :q OR user.email ILIKE :q OR user.phone ILIKE :q)',
        { q: `%${search.trim()}%` },
      );
    }

    const patients = await qb.getMany();
    return patients.map(formatPatient);
  }

  async findByUserId(userId: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    await this.assertActiveMembership(patient.id);
    return formatPatient(patient);
  }

  async findOne(id: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    await this.assertActiveMembership(patient.id);
    return formatPatient(patient);
  }

  async update(patientId: string, updatePatientDto: UpdatePatientDto) {
    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    await this.assertActiveMembership(patient.id);

    // Update global patient profile fields
    if (updatePatientDto.gender !== undefined)
      patient.gender = updatePatientDto.gender;
    if (updatePatientDto.address !== undefined)
      patient.address = updatePatientDto.address;
    if (updatePatientDto.age !== undefined)
      patient.dob = this.calculateDob(updatePatientDto.age);
    if (updatePatientDto.dob !== undefined)
      patient.dob = updatePatientDto.dob
        ? new Date(updatePatientDto.dob)
        : null;

    // TODO: Remove this once we have a global user service
    const userUpdate: any = {};
    if (updatePatientDto.email !== undefined)
      userUpdate.email = updatePatientDto.email;
    if (updatePatientDto.name !== undefined)
      userUpdate.name = updatePatientDto.name;
    if (updatePatientDto.phone !== undefined)
      userUpdate.phone = updatePatientDto.phone;
    if (updatePatientDto.password !== undefined)
      userUpdate.password = updatePatientDto.password;
    if (Object.keys(userUpdate).length > 0) {
      await this.usersService.update(patient.user_id, userUpdate);
    }

    await patientRepository.save(patient);
    const updated = await patientRepository.findOne({
      where: { id: patient.id },
      relations: ['user'],
    });
    return updated ? formatPatient(updated) : formatPatient(patient);
  }

  async remove(patientId: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const patientRepository = await this.getPatientRepository();
    const membershipRepository = await this.getMembershipRepository();

    const patient = await patientRepository.findOne({
      where: { id: patientId },
      relations: ['user'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const membership = await membershipRepository.findOne({
      where: { patientId: patient.id, tenantSlug },
    });
    if (
      !membership ||
      membership.status !== PatientTenantMembershipStatus.ACTIVE
    ) {
      throw new NotFoundException('Patient not found');
    }

    const before = {
      status: membership.status,
      shareMedicalHistory: membership.shareMedicalHistory,
    };
    membership.status = PatientTenantMembershipStatus.REVOKED;
    await membershipRepository.save(membership);
    await this.auditMembershipChange({
      patientId: patient.id,
      tenantSlug,
      action: PatientMembershipAuditAction.MEMBERSHIP_REVOKED,
      before,
      after: {
        status: membership.status,
        shareMedicalHistory: membership.shareMedicalHistory,
      },
    });

    // Also remove tenant access from the patient's user account
    const nextCompanies = (patient.user?.companies ?? []).filter(
      (c) => String(c).trim().toLowerCase() !== tenantSlug,
    );
    if (
      patient.user &&
      nextCompanies.length !== (patient.user.companies ?? []).length
    ) {
      await this.usersService.update(patient.user_id, {
        companies: nextCompanies,
      });
    }

    return { message: 'Patient removed from organization' };
  }

  async restore(patientId: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const patientRepository = await this.getPatientRepository();
    const membershipRepository = await this.getMembershipRepository();

    const patient = await patientRepository.findOne({
      where: { id: patientId },
      relations: ['user'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const membership =
      (await membershipRepository.findOne({
        where: { patientId: patient.id, tenantSlug },
      })) ??
      membershipRepository.create({
        patientId: patient.id,
        tenantSlug,
        shareMedicalHistory: true,
      });

    membership.status = PatientTenantMembershipStatus.ACTIVE;
    await membershipRepository.save(membership);
    await this.auditMembershipChange({
      patientId: patient.id,
      tenantSlug,
      action: PatientMembershipAuditAction.MEMBERSHIP_RESTORED,
      after: {
        status: membership.status,
        shareMedicalHistory: membership.shareMedicalHistory,
      },
    });

    // Ensure patient user can access the tenant again
    const current = patient.user?.companies ?? [];
    const normalized = current.map((c) => String(c).trim().toLowerCase());
    if (!normalized.includes(tenantSlug)) {
      await this.usersService.update(patient.user_id, {
        companies: [...current, tenantSlug],
      });
    }

    const restored = await patientRepository.findOne({
      where: { id: patient.id },
      relations: ['user'],
    });
    return restored ? formatPatient(restored) : formatPatient(patient);
  }
}
