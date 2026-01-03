import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
  Between,
  DataSource,
  In,
  MoreThanOrEqual,
  Not,
  QueryRunner,
} from 'typeorm';
import { Request } from 'express';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { CurrentUserPayload } from '@/client/auth/decorators/current-user.decorator';
import { BaseTenantService } from '@/tenancy/base-tenant.service';
import { CONNECTION } from '@/tenancy/tenancy.symbols';
import { TenantAuthInitService } from '@/tenancy/tenant-auth-init.service';
import { Queue, QueueStatus } from './entities/queue.entity';
import { PaymentMode } from './enums/queue.enum';
import { Doctor } from '@/client/doctors/entities/doctor.entity';
import { ApiResponse } from 'src/common/response-wrapper';
import { appointmentConfirmationTemplate, formatQueue } from './queue.helper';
import { CompleteQueueDto } from './dto/compelete-queue.dto';
import { PaymentsService } from '@/client/payments/payments.service';
import {
  Payment,
  PaymentProvider,
  PaymentReferenceType,
  PaymentStatus,
} from '@/client/payments/entities/payment.entity';
import { RazorpayService } from '@/client/payments/razorpay.service';
import { VerifyPaymentDto } from '@/client/payments/dto/verify-payment.dto';
import { Role } from 'src/common/enums/role.enum';
import { PdfService } from '@/client/pdf/pdf.service';

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
    private readonly razorpayService: RazorpayService,
    private readonly pdfService: PdfService,
  ) {
    super(request, connection, tenantAuthInitService, QueueService.name);
  }

  async create(createQueueDto: CreateQueueDto, user: CurrentUserPayload) {
    await this.ensureTablesExist();

    const doctor = await this.getRepository(Doctor).findOne({
      where: { id: createQueueDto.doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const lastSequenceNumber = doctor.lastSequenceNumber ?? 0;

    // Start transaction
    const queryRunner: QueryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let result = null;

    try {
      const manager = queryRunner.manager;

      // Update doctor's last sequence number
      await manager.update(
        Doctor,
        { id: createQueueDto.doctorId },
        { lastSequenceNumber: lastSequenceNumber + 1 },
      );

      // Create and save queue
      const queue = manager.create(Queue, {
        ...createQueueDto,
        bookedBy: user.userId,
        sequenceNumber: lastSequenceNumber + 1,
        status:
          createQueueDto.paymentMode === PaymentMode.CASH
            ? user.role === Role.PATIENT
              ? QueueStatus.PAYMENT_PENDING
              : QueueStatus.BOOKED
            : undefined,
      });

      const savedQueue = await manager.save(Queue, queue);

      // Create payment order if RAZORPAY mode
      if (createQueueDto.paymentMode === PaymentMode.RAZORPAY) {
        const amountInPaise = 100 * 100; // TODO: get amount from doctor's fee

        // Create Razorpay order (external API call)
        const razorpayOrder = await this.razorpayService.createOrder(
          amountInPaise,
          `receipt_${new Date().toISOString()}`,
        );

        // Create payment entity within transaction
        const payment = manager.create(Payment, {
          provider: PaymentProvider.RAZORPAY,
          orderId: razorpayOrder.id,
          amount: amountInPaise,
          currency: 'INR',
          status: PaymentStatus.CREATED,
          referenceType: PaymentReferenceType.APPOINTMENT_QUEUE,
          referenceId: savedQueue.id,
        });

        await manager.save(Payment, payment);

        result = {
          orderId: razorpayOrder.id,
          amount: amountInPaise,
          currency: 'INR',
        };
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      return ApiResponse.success(
        {
          ...(await this.findOne(savedQueue.id)),
          ...result,
        },
        'Queue created successfully',
      );
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    await this.ensureTablesExist();
    const payment = await this.paymentsService.verifyPayment(verifyPaymentDto);

    // update queue status to booked
    const queueRepository = this.getRepository(Queue);
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
    return ApiResponse.success(queue, 'Payment verified');
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

    this.logger.log(`Queue ID: ${queueId}`);

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

    return ApiResponse.success({
      previous: previousQueues.map(formatQueue),
      current: current ? formatQueue(current) : null,
      next: next ? next.map(formatQueue) : null,
    });
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

    return ApiResponse.success(
      queue,
      `${queue.patient.user.name} has been called`,
    );
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

    return ApiResponse.success(
      null,
      `${queue.patient.user.name}'s turn is skipped`,
    );
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

    return ApiResponse.success(null, 'Appointment has been started');
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

    return ApiResponse.success(null, 'Appointment completed successfully');
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
