import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Between, DataSource, In, MoreThanOrEqual, Not } from 'typeorm';
import { Request } from 'express';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { CurrentUserPayload } from '@/client/auth/decorators/current-user.decorator';
import { BaseTenantService } from '@/tenancy/base-tenant.service';
import { CONNECTION } from '@/tenancy/tenancy.symbols';
import { TenantAuthInitService } from '@/tenancy/tenant-auth-init.service';
import { Queue, QueueStatus } from './entities/queue.entity';
import { Doctor } from '@/client/doctors/entities/doctor.entity';
import { formatQueue, generateReferenceNumber } from './queue.helper';
import { CompleteQueueDto } from './dto/compelete-queue.dto';
import { PaymentsService } from '@/client/payments/payments.service';
import { VerifyPaymentDto } from '@/client/payments/dto/verify-payment.dto';
import { PdfService } from '@/client/pdf/pdf.service';
import { DoctorsService } from '@/client/doctors/doctors.service';
import { PaymentReferenceType } from '@/client/payments/entities/payment.entity';
import { Currency } from '@/client/payments/dto/create-payment.dto';
import { Role } from 'src/common/enums/role.enum';
import { PaymentMode } from './enums/queue.enum';
import { appointmentConfirmationTemplate } from './templates/confirm-appointment.template';

const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

const queueRelations = [
  'patient',
  'patient.user',
  'doctor',
  'doctor.user',
  'bookedByUser',
  'completedByUser',
];

@Injectable()
export class QueueService extends BaseTenantService {
  constructor(
    @Inject(REQUEST) request: Request,
    @Inject(CONNECTION) connection: DataSource | null,
    tenantAuthInitService: TenantAuthInitService,
    private readonly paymentsService: PaymentsService,
    private readonly doctorsService: DoctorsService,
    private readonly pdfService: PdfService,
  ) {
    super(request, connection, tenantAuthInitService, QueueService.name);
  }

  private getQueueRepository() {
    return this.getRepository(Queue);
  }

  // check if a queue is already booked for the same doctor and patient for that date
  async checkIfQueueIsBooked(doctorId: string, patientId: string) {
    const queueRepository = this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: { doctorId, patientId, createdAt: Between(todayStart, todayEnd) },
    });
    return queue;
  }

  async create(createQueueDto: CreateQueueDto) {
    await this.ensureTablesExist();

    const existingQueue = await this.checkIfQueueIsBooked(
      createQueueDto.doctorId,
      createQueueDto.patientId,
    );

    if (existingQueue && this.request.user.role === Role.PATIENT) {
      throw new BadRequestException(
        `You already have an appointment booked  <a class="underline text-primary-500" href="/appointments/queues/${existingQueue.id}">view</a>`,
      );
    }

    const doctor = await this.doctorsService.findOne(createQueueDto.doctorId);

    // start transaction
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const status =
        createQueueDto.paymentMode === PaymentMode.CASH
          ? QueueStatus.PAYMENT_PENDING
          : QueueStatus.PAYMENT_FAILED;

      const queue = queryRunner.manager.create(Queue, {
        ...createQueueDto,
        referenceNumber: generateReferenceNumber(),
        sequenceNumber: doctor.lastSequenceNumber + 1 || 1,
        status,
        bookedBy: this.request.user.userId,
      });

      await queryRunner.manager.save(Queue, queue);

      await queryRunner.manager.increment(
        Doctor,
        { id: createQueueDto.doctorId },
        'lastSequenceNumber',
        1,
      );

      await queryRunner.commitTransaction();
      return queue;
    } catch (error) {
      this.logger.error(error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createPayment(queueId: string) {
    await this.ensureTablesExist();
    const queue = await this.getQueueRepository().findOne({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException(`Queue with ID ${queueId} not found`);
    }

    return await this.paymentsService.createPayment({
      referenceId: queueId,
      amount: 10000,
      currency: Currency.INR,
      referenceType: PaymentReferenceType.APPOINTMENT_QUEUE,
    });
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    await this.ensureTablesExist();
    const payment = await this.paymentsService.verifyPayment(verifyPaymentDto);

    // update queue status to booked
    const queueRepository = this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: { id: payment.referenceId },
    });

    if (!queue) {
      throw new NotFoundException(
        `Queue with ID ${payment.referenceId} not found`,
      );
    }
    queue.status = QueueStatus.BOOKED;
    await queueRepository.save(queue);
    return queue;
  }

  async cancelPayment(queueId: string, remark?: string) {
    const queue = await this.getQueueRepository().findOne({
      where: { id: queueId },
    });
    if (!queue) {
      throw new NotFoundException(`Queue with ID ${queueId} not found`);
    }

    queue.status = QueueStatus.CANCELLED;
    queue.cancellationDetails = {
      by: this.request.user.userId,
      remark,
    };
    return await this.getQueueRepository().save(queue);
  }

  async findAll(date?: string) {
    await this.ensureTablesExist();

    const qb = await this.getRepository(Queue).find({
      where: {
        createdAt: date ? MoreThanOrEqual(new Date(date)) : undefined,
      },
      relations: queueRelations,
      order: {
        sequenceNumber: 'ASC',
      },
    });

    return qb.map(formatQueue);
  }

  async findOne(id: string) {
    await this.ensureTablesExist();

    const qb = await this.getRepository(Queue).findOne({
      where: { id },
      relations: queueRelations,
    });

    const formattedQueue = formatQueue(qb);
    return formattedQueue;
  }

  async update(id: string, updateQueueDto: UpdateQueueDto) {
    await this.ensureTablesExist();
    const queueRepository = this.getRepository(Queue);

    const queue = await queueRepository.findOne({ where: { id } });
    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    if (updateQueueDto.doctorId) {
      const doctorRepository = this.getRepository(Doctor);
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
    const queueRepository = this.getRepository(Queue);

    const queue = await queueRepository.findOne({ where: { id } });

    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    await queueRepository.remove(queue);

    return {
      message: 'Queue entry deleted successfully',
    };
  }

  async getQueueForDoctor(doctorId: string, queueId?: string) {
    let requestedQueue: Queue | null = null;

    if (queueId) {
      requestedQueue = await this.getRepository(Queue).findOne({
        where: { id: queueId },
        relations: queueRelations,
      });
      if (!requestedQueue) {
        throw new NotFoundException(`Queue with ID ${queueId} not found`);
      }
    }

    const previousQueues = await this.getRepository(Queue).find({
      where: {
        doctorId,
        createdAt: Between(todayStart, todayEnd),
        status: In([QueueStatus.COMPLETED, QueueStatus.CANCELLED]),
      },

      relations: queueRelations,
      order: {
        sequenceNumber: 'DESC',
      },
    });

    const nextQueues = await this.getRepository(Queue).find({
      where: {
        doctorId,
        createdAt: Between(todayStart, todayEnd),
        status: Not(In([QueueStatus.COMPLETED, QueueStatus.CANCELLED])),
      },
      relations: queueRelations,
      order: {
        status: 'ASC',
        counter: {
          skip: 'ASC',
        },
        sequenceNumber: 'ASC',
      },
    });

    // add the id of next queue in the each queue
    const next = queueId
      ? nextQueues.filter((queue) => queue.id !== queueId)
      : nextQueues.slice(1);

    const currentQueue = queueId ? requestedQueue : nextQueues[0];
    const current = currentQueue
      ? {
          ...currentQueue,
          nextQueueId: next[0]?.id,
          previousQueueId: previousQueues[0]?.id,
        }
      : null;

    return {
      previous: previousQueues.map(formatQueue),
      current: current ? formatQueue(current) : null,
      next: next ? next.map(formatQueue) : null,
    };
  }

  // Call queue by id
  async callQueue(id: string) {
    const queueRepository = this.getRepository(Queue);
    const queue = await queueRepository.findOne({
      where: { id },
      relations: queueRelations,
    });
    if (!queue) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    if (
      ![QueueStatus.BOOKED, QueueStatus.SKIPPED, QueueStatus.CALLED].includes(
        queue.status,
      )
    ) {
      throw new BadRequestException('Patient is already called');
    }

    queue.status = QueueStatus.CALLED;
    queue.counter = {
      skip: queue.counter?.skip || 0,
      clockIn: queue.counter?.clockIn || 0,
      call: queue.counter?.call + 1 || 1,
    };
    await queueRepository.save(queue);

    return queue;
  }

  // skip queue by id
  async skipQueue(id: string) {
    const queueRepository = this.getRepository(Queue);
    const queue = await queueRepository.findOne({
      where: { id },
      relations: queueRelations,
    });
    if (!queue) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    if (
      ![
        QueueStatus.BOOKED,
        QueueStatus.SKIPPED,
        QueueStatus.CALLED,
        QueueStatus.IN_CONSULTATION,
      ].includes(queue.status)
    ) {
      throw new BadRequestException(
        'The appointment is not in a valid state to skip',
      );
    }

    queue.status = QueueStatus.SKIPPED;
    queue.counter = {
      skip: queue.counter?.skip + 1 || 1,
      clockIn: queue.counter?.clockIn || 0,
      call: queue.counter?.call || 0,
    };
    await queueRepository.save(queue);

    return null;
  }

  // clock in
  async clockIn(id: string) {
    const queueRepository = this.getRepository(Queue);
    const queue = await queueRepository.findOne({ where: { id } });
    if (!queue) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    if (queue.status !== QueueStatus.CALLED) {
      throw new BadRequestException(
        'Please call the appointment before clocking in',
      );
    }

    queue.status = QueueStatus.IN_CONSULTATION;
    queue.counter = {
      skip: queue.counter?.skip || 0,
      clockIn: queue.counter?.clockIn + 1 || 1,
      call: queue.counter?.call || 0,
    };
    queue.startedAt = new Date();
    await queueRepository.save(queue);

    return null;
  }

  // complete appointment queue
  async completeAppointmentQueue(
    id: string,
    completeQueueDto: CompleteQueueDto,
    user: CurrentUserPayload,
  ) {
    const queueRepository = this.getRepository(Queue);

    const queue = await queueRepository.findOne({
      where: { id },
      relations: queueRelations,
    });
    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    if (queue.status !== QueueStatus.IN_CONSULTATION) {
      throw new BadRequestException(
        'Appointment should be in consultation to complete',
      );
    }

    Object.assign(queue, {
      ...completeQueueDto,
      status: QueueStatus.COMPLETED,
      completedBy: user.userId,
      completedAt: new Date(),
    });

    await queueRepository.save(queue);
  }

  async appointmentReceiptPdf(id: string) {
    await this.ensureTablesExist();

    const queue = await this.getRepository(Queue).findOne({
      where: { id },
      relations: queueRelations,
    });

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    const html = appointmentConfirmationTemplate({
      ...queue,
      id: queue.id.slice(-6).toUpperCase(),
    });

    const pdf = await this.pdfService.htmlToPdf(html, 'A6');

    return {
      pdf,
      metaData: {
        title: 'Appointment Receipt',
        filename: `${queue.patient.user.name.replace(' ', '_')}_${queue.sequenceNumber}.pdf`,
      },
    };
  }
}
