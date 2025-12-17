import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { Request } from 'express';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { CurrentUserPayload } from '@/client/auth/decorators/current-user.decorator';
import { BaseTenantService } from '@/tenancy/base-tenant.service';
import { CONNECTION } from '@/tenancy/tenancy.symbols';
import { TenantAuthInitService } from '@/tenancy/tenant-auth-init.service';
import { Queue } from './entities/queue.entity';
import { Patient } from '@/client/patients/entities/patient.entity';
import { Doctor } from '@/client/doctors/entities/doctor.entity';
import { TenantUser } from '@/client/auth/entities/tenant-user.entity';

const appointmentQueueSelect = {
  id: true,
  sequenceNumber: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    id: true,
    age: true,
  },

  doctor: {
    id: true,
    specialization: true,
  },

  bookedByUser: {
    id: true,
    name: true,
    email: true,
  },
};

@Injectable()
export class QueueService extends BaseTenantService {
  constructor(
    @Inject(REQUEST) request: Request,
    @Inject(CONNECTION) connection: DataSource | null,
    tenantAuthInitService: TenantAuthInitService,
  ) {
    super(request, connection, tenantAuthInitService, QueueService.name);
  }

  private getQueueRepository() {
    return this.getRepository(Queue);
  }

  private getPatientRepository() {
    return this.getRepository(Patient);
  }

  private getDoctorRepository() {
    return this.getRepository(Doctor);
  }

  private getUserRepository() {
    return this.getRepository(TenantUser);
  }

  private async ensureRelationsExist(createQueueDto: CreateQueueDto) {
    const patientRepository = this.getPatientRepository();
    const doctorRepository = this.getDoctorRepository();

    const patient = await patientRepository.findOne({
      where: { id: createQueueDto.patientId },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createQueueDto.patientId} not found`,
      );
    }

    const doctor = await doctorRepository.findOne({
      where: { id: createQueueDto.doctorId },
    });

    if (!doctor) {
      throw new NotFoundException(
        `Doctor with ID ${createQueueDto.doctorId} not found`,
      );
    }
  }

  async create(createQueueDto: CreateQueueDto, user: CurrentUserPayload) {
    await this.ensureTablesExist();

    const bookedByUser = await this.getUserRepository().findOne({
      where: { id: user.userId },
    });

    if (!bookedByUser) {
      throw new NotFoundException('Booking user not found');
    }

    await this.ensureRelationsExist(createQueueDto);

    if (!this.connection) {
      throw new NotFoundException('Tenant connection not available');
    }

    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const queueRepository = queryRunner.manager.getRepository(Queue);

      const latestToday = await queueRepository
        .createQueryBuilder('queue')
        .setLock('pessimistic_write')
        .where('queue.createdAt >= CURRENT_DATE')
        .andWhere("queue.createdAt < CURRENT_DATE + INTERVAL '1 day'")
        .orderBy('queue.sequenceNumber', 'DESC')
        .limit(1)
        .getOne();

      const nextSequenceNumber = (latestToday?.sequenceNumber || 0) + 1;

      const queue = queueRepository.create({
        ...createQueueDto,
        bookedBy: user.userId,
        sequenceNumber: nextSequenceNumber,
      });

      const savedQueue = await queueRepository.save(queue);
      await queryRunner.commitTransaction();

      return {
        message: 'Queue entry created successfully',
        data: await this.findOne(savedQueue.id),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(date?: string) {
    await this.ensureTablesExist();
    const qb = await this.getQueueRepository().find({
      where: {
        createdAt: date ? MoreThanOrEqual(new Date(date)) : undefined,
      },
      relations: ['patient', 'doctor', 'bookedByUser'],
      select: appointmentQueueSelect,
    });

    return qb;
  }

  async findOne(id: string) {
    await this.ensureTablesExist();
    const qb = this.getQueueRepository().findOne({
      where: { id },
      relations: ['patient', 'doctor', 'bookedByUser'],
      select: appointmentQueueSelect,
    });

    return qb;
  }

  async update(id: string, updateQueueDto: UpdateQueueDto) {
    await this.ensureTablesExist();
    const queueRepository = this.getQueueRepository();

    const queue = await queueRepository.findOne({ where: { id } });
    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    if (updateQueueDto.doctorId) {
      const doctorRepository = this.getDoctorRepository();
      const doctor = await doctorRepository.findOne({
        where: { id: updateQueueDto.doctorId },
      });

      if (!doctor) {
        throw new NotFoundException(
          `Doctor with ID ${updateQueueDto.doctorId} not found`,
        );
      }
    }

    Object.assign(queue, updateQueueDto);
    await queueRepository.save(queue);

    return {
      message: 'Queue entry updated successfully',
      data: await this.findOne(id),
    };
  }

  async remove(id: string) {
    await this.ensureTablesExist();
    const queueRepository = this.getQueueRepository();

    const queue = await queueRepository.findOne({ where: { id } });

    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    await queueRepository.remove(queue);

    return {
      message: 'Queue entry deleted successfully',
    };
  }
}
