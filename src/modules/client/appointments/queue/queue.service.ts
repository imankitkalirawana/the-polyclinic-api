import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Between, Equal, In, LessThan, MoreThanOrEqual, Not } from 'typeorm';
import { Request } from 'express';
import { CreateQueueDto } from './dto/create-queue.dto';
import { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { Queue, QueueStatus } from './entities/queue.entity';
import {
  formatQueue,
  generateAppointmentId,
  buildSequenceName,
  ensureSequenceExists,
  getNextTokenNumber,
} from './queue.helper';
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
import { QrService } from '@/client/qr/qr.service';
import { ActivityService } from '@/common/activity/services/activity.service';
import { ActivityLogService } from '@/common/activity/services/activity-log.service';
import { EntityType } from '@/common/activity/enums/entity-type.enum';
import { getTenantConnection } from 'src/common/db/tenant-connection';

import { PatientsService } from '@/client/patients/patients.service';

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
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly paymentsService: PaymentsService,
    private readonly patientsService: PatientsService,
    private readonly doctorsService: DoctorsService,
    private readonly patientService: PatientsService,
    private readonly pdfService: PdfService,
    private readonly qrService: QrService,
    private readonly activityService: ActivityService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private getSchema(): string {
    const schema = this.request?.schema;
    if (!schema) {
      throw new UnauthorizedException('Schema is required');
    }
    return schema;
  }

  private async getConnection() {
    return await getTenantConnection(this.getSchema());
  }

  private async getQueueRepository() {
    const connection = await this.getConnection();
    return connection.getRepository(Queue);
  }

  private sortQueuesByPriority(queues: Queue[]): Queue[] {
    const STATUS_PRIORITY: Partial<Record<QueueStatus, number>> = {
      [QueueStatus.IN_CONSULTATION]: 1,
      [QueueStatus.CALLED]: 2,
      [QueueStatus.BOOKED]: 3,
      [QueueStatus.SKIPPED]: 4,
    };

    const isSkipped = (q: Queue) => q.status === QueueStatus.SKIPPED;
    const skipCount = (q: Queue) => q.counter?.skip ?? 0;

    return [...queues].sort((a, b) => {
      /* 1️⃣ Non-skipped before skipped */
      if (isSkipped(a) !== isSkipped(b)) {
        return Number(isSkipped(a)) - Number(isSkipped(b));
      }

      /* 2️⃣ Status priority (applies naturally to non-skipped) */
      const statusDiff =
        (STATUS_PRIORITY[a.status] ?? 999) - (STATUS_PRIORITY[b.status] ?? 999);
      if (statusDiff !== 0) return statusDiff;

      /* 3️⃣ Skip count (lower first) */
      const skipDiff = skipCount(a) - skipCount(b);
      if (skipDiff !== 0) return skipDiff;

      /* 4️⃣ Sequence number (lower first) */
      return a.sequenceNumber - b.sequenceNumber;
    });
  }

  // check if a queue is already booked for the same doctor and patient for that date
  async checkIfQueueIsBooked(doctorId: string, patientId: string) {
    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: { doctorId, patientId, createdAt: Between(todayStart, todayEnd) },
    });
    return queue;
  }

  private async checkDoctorExists(doctorId: string) {
    const doctor = await this.doctorsService.findOne(doctorId);
    if (!doctor) {
      throw new BadRequestException('Doctor not found');
    }
    return doctor;
  }

  async create(createQueueDto: CreateQueueDto) {
    const existingQueue = await this.checkIfQueueIsBooked(
      createQueueDto.doctorId,
      createQueueDto.patientId,
    );

    if (createQueueDto.appointmentDate < new Date()) {
      throw new BadRequestException('Cannot book appointment in the past');
    }

    await this.patientsService.checkPatientExists(
      createQueueDto.patientId,
      true,
    );
    await this.checkDoctorExists(createQueueDto.doctorId);

    if (existingQueue && this.request.user.role === Role.PATIENT) {
      throw new BadRequestException(
        `You already have an appointment booked  <a class="underline text-primary-500" href="/appointments/queues/${existingQueue.id}">view</a>`,
      );
    }

    const doctor = await this.doctorsService.findOne(createQueueDto.doctorId);

    // start transaction
    const connection = await this.getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let status: QueueStatus;

      if (
        createQueueDto.paymentMode === PaymentMode.CASH &&
        (this.request.user.role === Role.ADMIN ||
          this.request.user.role === Role.RECEPTIONIST)
      ) {
        status = QueueStatus.BOOKED;
      } else if (createQueueDto.paymentMode === PaymentMode.CASH) {
        status = QueueStatus.PAYMENT_PENDING;
      } else {
        status = QueueStatus.PAYMENT_FAILED;
      }

      // Get tenant schema name
      const schema = this.getSchema();

      // Build sequence name for this doctor and appointment date
      const sequenceName = buildSequenceName(
        createQueueDto.doctorId,
        createQueueDto.appointmentDate,
      );

      // Ensure sequence exists (with advisory lock protection)
      await ensureSequenceExists(queryRunner, schema, sequenceName);

      // Get next token number from sequence
      const sequenceNumber = await getNextTokenNumber(
        queryRunner,
        schema,
        sequenceName,
      );

      // Generate appointment ID (aid)
      const aid = generateAppointmentId(
        createQueueDto.appointmentDate,
        doctor.code,
        sequenceNumber,
      );

      const queue = queryRunner.manager.create(Queue, {
        ...createQueueDto,
        aid,
        sequenceNumber,
        status,
        bookedBy: this.request.user.userId,
      });

      await queryRunner.manager.save(Queue, queue);

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
    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException(`Queue with ID ${queueId} not found`);
    }

    const payment = await this.paymentsService.createPayment({
      referenceId: queueId,
      amount: 10000,
      currency: Currency.INR,
      referenceType: PaymentReferenceType.APPOINTMENT_QUEUE,
    });

    return payment;
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    const payment = await this.paymentsService.verifyPayment(verifyPaymentDto);

    // update queue status to booked
    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: { id: payment.referenceId },
    });

    if (!queue) {
      throw new NotFoundException(
        `Queue with ID ${payment.referenceId} not found`,
      );
    }

    const previousStatus = queue.status;
    queue.status = QueueStatus.BOOKED;
    await queueRepository.save(queue);

    this.activityService.logStatusChange({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: { status: previousStatus },
      after: { status: queue.status },
      description: `Payment verified and appointment status updated`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });

    return queue;
  }

  async cancelPayment(queueId: string, remark?: string) {
    const queue = await this.findOne(queueId);

    const previousStatus = queue.status;
    queue.status = QueueStatus.CANCELLED;
    queue.cancellationDetails = {
      by: this.request.user.userId,
      remark,
    };
    const queueRepository = await this.getQueueRepository();
    await queueRepository.save(queue);

    this.activityService.logStatusChange({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: { status: previousStatus },
      after: { status: queue.status },
      description: `Appointment cancelled by ${this.request.user?.name || 'user'}.`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });
    return queue;
  }

  async findAll(date?: string) {
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');

    const repo = await this.getQueueRepository();
    const qb = await repo.find({
      where: {
        createdAt: date ? MoreThanOrEqual(new Date(date)) : undefined,
      },
      withDeleted: true,
      relations: queueRelations,
      order: {
        aid: 'DESC',
      },
    });

    return qb.map((queue) => formatQueue(queue, user.role));
  }

  async findOne(id: string) {
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');

    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: {
        id,
      },
      withDeleted: true,
      relations: queueRelations,
    });

    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    return queue;
  }

  async findByAid(aid: string) {
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');

    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: {
        aid,
      },
      relations: queueRelations,
    });
    if (!queue) {
      throw new NotFoundException(`Queue with AID ${aid} not found`);
    }
    return formatQueue(queue, user.role);
  }

  async remove(id: string) {
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');

    const queueRepository = await this.getQueueRepository();

    const queue = await queueRepository.findOne({ where: { id } });

    if (!queue) {
      throw new NotFoundException(`Queue with ID ${id} not found`);
    }

    await queueRepository.remove(queue);
    this.activityService.logDelete({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      data: queue,
      description: `Appointment deleted by ${this.request.user?.name || 'user'}.`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });

    return {
      message: 'Queue entry deleted successfully',
    };
  }

  async getQueueForDoctor({
    doctorId,
    queueId,
    appointmentDate = new Date(),
  }: {
    doctorId: string;
    queueId?: string;
    appointmentDate?: Date;
  }) {
    let requestedQueue: Queue | null = null;

    if (queueId) {
      const queueRepository = await this.getQueueRepository();
      requestedQueue = await queueRepository.findOne({
        where: { id: queueId },
        relations: queueRelations,
      });
      if (!requestedQueue) {
        throw new NotFoundException(`Queue with ID ${queueId} not found`);
      }
    }

    const queueRepository = await this.getQueueRepository();
    const previousQueues = await queueRepository.find({
      where: {
        doctorId,
        appointmentDate: Equal(appointmentDate),
        status: In([QueueStatus.COMPLETED, QueueStatus.CANCELLED]),
      },

      relations: queueRelations,
      order: {
        sequenceNumber: 'DESC',
      },
    });

    const nextQueues = await queueRepository.find({
      where: {
        doctorId,
        appointmentDate: Equal(appointmentDate),
        status: Not(
          In([
            QueueStatus.COMPLETED,
            QueueStatus.CANCELLED,
            QueueStatus.PAYMENT_FAILED,
            QueueStatus.PAYMENT_PENDING,
          ]),
        ),
      },
      relations: queueRelations,
      order: {
        sequenceNumber: 'ASC',
      },
    });

    const sortedNextQueues = this.sortQueuesByPriority(nextQueues);

    // add the id of next queue in the each queue
    const next = queueId
      ? sortedNextQueues.filter((queue) => queue.id !== queueId)
      : sortedNextQueues.slice(1);

    const currentQueue = queueId ? requestedQueue : sortedNextQueues[0];
    const current = currentQueue
      ? {
          ...currentQueue,
          nextQueueId: next[0]?.id,
          previousQueueId: previousQueues[0]?.id,
        }
      : null;

    return {
      previous: previousQueues.map((queue) =>
        formatQueue(queue, this.request.user.role),
      ),
      current: current ? formatQueue(current, this.request.user.role) : null,
      next: next
        ? next.map((queue) => formatQueue(queue, this.request.user.role))
        : null,

      metaData: {
        totalPrevious: previousQueues.length,
        totalNext: next.length,
      },
    };
  }

  async getQueueForPatient() {
    const queueRepo = await this.getQueueRepository();
    const now = new Date();
    const userId = this.request.user.userId;
    const patient = await this.patientService.findByUserId(userId);

    const previousQueues = await queueRepo.find({
      where: [
        {
          patientId: patient.id,
          status: In([QueueStatus.COMPLETED, QueueStatus.CANCELLED]),
        },
        {
          patientId: patient.id,
          appointmentDate: LessThan(now),
        },
      ],
      relations: queueRelations,
      order: {
        appointmentDate: 'DESC',
      },
    });

    const nextQueues = await queueRepo.find({
      where: {
        patientId: patient.id,
        status: Not(In([QueueStatus.COMPLETED, QueueStatus.CANCELLED])),
        appointmentDate: MoreThanOrEqual(now),
      },
      relations: queueRelations,
      order: {
        appointmentDate: 'ASC',
      },
    });

    // latest upcoming appointment
    const latestUpcomingAppointment = nextQueues[0];

    return {
      previous: previousQueues.map((queue) =>
        formatQueue(queue, this.request.user.role),
      ),
      current: formatQueue(latestUpcomingAppointment, this.request.user.role),
      next: nextQueues
        .slice(1)
        .map((queue) => formatQueue(queue, this.request.user.role)),
      metaData: {
        totalPrevious: previousQueues.length,
        totalNext: nextQueues.length - 1,
      },
    };
  }

  //get appointment by aid
  async getAppointmentByAid(aid: string) {
    const userId = this.request.user.userId;

    let patientId = undefined;
    if (this.request.user.role === Role.PATIENT) {
      patientId = (await this.patientService.findByUserId(userId)).id;
    }

    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: { aid, patientId },
      relations: queueRelations,
    });
    if (!queue) {
      throw new NotFoundException(`Appointment with AID ${aid} not found`);
    }
    return formatQueue(queue, this.request.user.role);
  }

  // Call queue by id
  async callQueue(id: string) {
    const queueRepository = await this.getQueueRepository();
    const queue = await this.findOne(id);

    if (
      ![QueueStatus.BOOKED, QueueStatus.SKIPPED, QueueStatus.CALLED].includes(
        queue.status,
      )
    ) {
      throw new BadRequestException('Patient is already called');
    }

    const previousStatus = queue.status;
    const previousCounter = queue.counter;

    queue.status = QueueStatus.CALLED;
    queue.counter = {
      skip: queue.counter?.skip || 0,
      clockIn: queue.counter?.clockIn || 0,
      call: queue.counter?.call + 1 || 1,
    };
    await queueRepository.save(queue);

    this.activityService.logStatusChange({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: { status: previousStatus, counter: previousCounter },
      after: { status: queue.status, counter: queue.counter },
      description: `Patient called by ${this.request.user?.name || 'user'}.`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });

    return formatQueue(queue, this.request.user.role);
  }

  // skip queue by id
  async skipQueue(id: string) {
    const queueRepository = await this.getQueueRepository();
    const queue = await this.findOne(id);

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

    const previousStatus = queue.status;
    const previousCounter = queue.counter;

    queue.status = QueueStatus.SKIPPED;
    queue.counter = {
      skip: queue.counter?.skip + 1 || 1,
      clockIn: queue.counter?.clockIn || 0,
      call: queue.counter?.call || 0,
    };
    await queueRepository.save(queue);

    this.activityService.logStatusChange({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: { status: previousStatus, counter: previousCounter },
      after: { status: queue.status, counter: queue.counter },
      description: `Appointment skipped by ${this.request.user?.name || 'user'}.`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });

    return formatQueue(queue, this.request.user.role);
  }

  // clock in
  async clockIn(id: string) {
    const queueRepository = await this.getQueueRepository();
    const queue = await this.findOne(id);

    if (queue.status !== QueueStatus.CALLED) {
      throw new BadRequestException(
        'Please call the appointment before clocking in',
      );
    }

    const previousStatus = queue.status;
    const previousCounter = queue.counter;
    queue.status = QueueStatus.IN_CONSULTATION;
    queue.counter = {
      skip: queue.counter?.skip || 0,
      clockIn: queue.counter?.clockIn + 1 || 1,
      call: queue.counter?.call || 0,
    };
    queue.startedAt = new Date();
    await queueRepository.save(queue);

    this.activityService.logStatusChange({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: { status: previousStatus, counter: previousCounter },
      after: { status: queue.status, counter: queue.counter },
      description: `Appointment clocked in by ${this.request.user?.name || 'user'}.`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });
    return formatQueue(queue, this.request.user.role);
  }

  // complete appointment queue
  async completeAppointmentQueue(
    id: string,
    completeQueueDto: CompleteQueueDto,
    user: CurrentUserPayload,
  ) {
    const queueRepository = await this.getQueueRepository();

    const queue = await this.findOne(id);

    if (
      ![QueueStatus.IN_CONSULTATION, QueueStatus.COMPLETED].includes(
        queue.status,
      )
    ) {
      throw new BadRequestException(
        'Appointment should be in consultation to complete',
      );
    }

    const previousStatus = queue.status;

    Object.assign(queue, {
      ...completeQueueDto,
      status: QueueStatus.COMPLETED,
      completedBy: user.user_id,
      completedAt: new Date(),
    });

    this.activityService.logStatusChange({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: { status: previousStatus },
      after: { status: queue.status },
      description: `Appointment completed by ${user.name || 'user'}.`,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });

    await queueRepository.save(queue);

    return formatQueue(queue, this.request.user.role);
  }

  async appointmentReceiptPdf(id: string) {
    const queue = await this.findOne(id);

    const url = `${process.env.APP_URL}/appointments/queues/${queue.aid}`;

    const qrCode = await this.qrService.generateBase64(url);

    const html = appointmentConfirmationTemplate(
      {
        ...queue,
        id: queue.id.slice(-6).toUpperCase(),
      },
      qrCode,
    );

    const pdf = await this.pdfService.htmlToPdf(html, 'A6');

    return {
      pdf,

      metaData: {
        title: 'Appointment Receipt',
        filename: `${queue.patient.user.name.replace(' ', '_')}_${queue.sequenceNumber}.pdf`,
      },
    };
  }

  async getActivityLogs(queueId: string) {
    const queue = await this.findOne(queueId);

    return this.activityLogService.getActivityLogsByEntity(
      EntityType.QUEUE,
      queue.id,
    );
  }
}
