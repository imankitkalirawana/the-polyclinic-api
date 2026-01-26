import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Between, Equal, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Request } from 'express';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { Queue, QueueStatus } from './entities/queue.entity';
import { Doctor } from '@/public/doctors/entities/doctor.entity';
import { Patient } from '@/public/patients/entities/patient.entity';
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
import {
  PatientTenantMembership,
  PatientTenantMembershipStatus,
} from '@/public/patients/entities/patient-tenant-membership.entity';
import {
  ClinicalRecord,
  ClinicalRecordType,
} from '@/public/clinical/entities/clinical-record.entity';
import {
  DoctorTenantMembership,
  DoctorTenantMembershipStatus,
} from '@/public/doctors/entities/doctor-tenant-membership.entity';

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
  private resolvedPatientId: string | undefined;
  private resolvedDoctorId: string | undefined;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly paymentsService: PaymentsService,
    private readonly doctorsService: DoctorsService,
    private readonly pdfService: PdfService,
    private readonly qrService: QrService,
    private readonly activityService: ActivityService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private getTenantSlug(): string {
    const tenantSlug = this.request?.tenantSlug;
    if (!tenantSlug) {
      throw new UnauthorizedException('Tenant schema is required');
    }
    return tenantSlug;
  }

  private async getConnection() {
    return await getTenantConnection(this.getTenantSlug());
  }

  private async getRepository<T>(entity: any): Promise<Repository<T>> {
    const connection = await this.getConnection();
    return connection.getRepository<T>(entity);
  }

  private async assertActivePatientMembership(patientId: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const repo = await this.getRepository<PatientTenantMembership>(
      PatientTenantMembership,
    );
    const membership = await repo.findOne({
      where: {
        patientId,
        tenantSlug,
        status: PatientTenantMembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      throw new NotFoundException('Patient not found');
    }
    return membership;
  }

  private async assertActiveDoctorMembership(doctorId: string) {
    const tenantSlug = this.getTenantSlug().trim().toLowerCase();
    const repo = await this.getRepository<DoctorTenantMembership>(
      DoctorTenantMembership,
    );
    const membership = await repo.findOne({
      where: {
        doctorId,
        tenantSlug,
        status: DoctorTenantMembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      throw new NotFoundException('Doctor not found');
    }
    return membership;
  }

  private async resolvePatientId(): Promise<string | undefined> {
    if (this.resolvedPatientId !== undefined) return this.resolvedPatientId;
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');
    if (user.role !== Role.PATIENT) {
      this.resolvedPatientId = undefined;
      return undefined;
    }

    const repo = await this.getRepository<Patient>(Patient);
    const patient = await repo.findOne({
      where: { user_id: user.userId },
      select: ['id'],
    });
    if (!patient) {
      throw new UnauthorizedException('Patient profile not found for user');
    }
    await this.assertActivePatientMembership(patient.id);
    this.resolvedPatientId = patient.id;
    return patient.id;
  }

  private async resolveDoctorId(): Promise<string | undefined> {
    if (this.resolvedDoctorId !== undefined) return this.resolvedDoctorId;
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');
    if (user.role !== Role.DOCTOR) {
      this.resolvedDoctorId = undefined;
      return undefined;
    }

    const repo = await this.getRepository<Doctor>(Doctor);
    const doctor = await repo.findOne({
      where: { user_id: user.userId },
      select: ['id'],
    });
    if (!doctor) {
      throw new UnauthorizedException('Doctor profile not found for user');
    }
    await this.assertActiveDoctorMembership(doctor.id);
    this.resolvedDoctorId = doctor.id;
    return doctor.id;
  }

  private getQueueRepository() {
    return this.getRepository<Queue>(Queue);
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

  async create(createQueueDto: CreateQueueDto) {
    // Prevent cross-tenant patient references
    await this.assertActivePatientMembership(createQueueDto.patientId);
    // Prevent cross-tenant doctor references
    const doctorMembership = await this.assertActiveDoctorMembership(
      createQueueDto.doctorId,
    );

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
    const doctorCode = doctor?.code ?? doctorMembership.code;
    if (!doctorCode) {
      throw new BadRequestException(
        'Doctor code is required for appointment booking',
      );
    }

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
      const tenantSlug = this.getTenantSlug();

      // Build sequence name for this doctor and appointment date
      const sequenceName = buildSequenceName(
        createQueueDto.doctorId,
        createQueueDto.appointmentDate,
      );

      // Ensure sequence exists (with advisory lock protection)
      await ensureSequenceExists(queryRunner, tenantSlug, sequenceName);

      // Get next token number from sequence
      const sequenceNumber = await getNextTokenNumber(
        queryRunner,
        tenantSlug,
        sequenceName,
      );

      // Generate appointment ID (aid)
      const aid = generateAppointmentId(
        createQueueDto.appointmentDate,
        doctorCode,
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
    const patientId = await this.resolvePatientId();
    const doctorId = await this.resolveDoctorId();

    const repo = await this.getRepository<Queue>(Queue);
    const qb = await repo.find({
      where: {
        patientId: patientId,
        doctorId: doctorId,
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
    const patientId = await this.resolvePatientId();
    const doctorId = await this.resolveDoctorId();

    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: {
        id,
        patientId: patientId,
        doctorId: doctorId,
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
    const patientId = await this.resolvePatientId();
    const doctorId = await this.resolveDoctorId();

    const queueRepository = await this.getQueueRepository();
    const queue = await queueRepository.findOne({
      where: {
        aid,
        patientId: patientId,
        doctorId: doctorId,
      },
      relations: queueRelations,
    });
    if (!queue) {
      throw new NotFoundException(`Queue with AID ${aid} not found`);
    }
    return formatQueue(queue, user.role);
  }

  async update(id: string, updateQueueDto: UpdateQueueDto) {
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');

    const queueRepository = await this.getQueueRepository();

    const queue = await this.findOne(id);

    if (updateQueueDto.doctorId) {
      await this.assertActiveDoctorMembership(updateQueueDto.doctorId);
    }

    const previousData = { ...queue };
    Object.assign(queue, updateQueueDto);
    await queueRepository.save(queue);

    this.activityService.logUpdate({
      entityType: EntityType.QUEUE,
      entityId: queue.id,
      module: 'appointments',
      before: previousData,
      after: queue,
      stakeholders: [queue.patient.user.id, queue.doctor.user.id],
    });

    return {
      message: 'Queue entry updated successfully',
      data: await this.findOne(id),
    };
  }

  async remove(id: string) {
    const user = this.request.user;
    if (!user) throw new UnauthorizedException('Unauthorized');

    const queueRepository = await this.getRepository<Queue>(Queue);

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
    // Prevent cross-tenant doctor access
    await this.assertActiveDoctorMembership(doctorId);

    let requestedQueue: Queue | null = null;

    if (queueId) {
      const queueRepository = await this.getRepository<Queue>(Queue);
      requestedQueue = await queueRepository.findOne({
        where: { id: queueId },
        relations: queueRelations,
      });
      if (!requestedQueue) {
        throw new NotFoundException(`Queue with ID ${queueId} not found`);
      }
    }

    const queueRepository = await this.getRepository<Queue>(Queue);
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
        appointmentDate: appointmentDate,
        totalPrevious: previousQueues.length,
        totalNext: next.length,
      },
    };
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

    // Write shared clinical records (public schema), idempotent by encounterRef+type
    try {
      const tenantSlug = this.getTenantSlug().trim().toLowerCase();
      const clinicalRepo =
        await this.getRepository<ClinicalRecord>(ClinicalRecord);
      const occurredAt = queue.completedAt ?? new Date();

      const notesPayload = {
        title: queue.title ?? null,
        notes: queue.notes ?? null,
        doctorId: queue.doctorId,
        aid: queue.aid,
        queueId: queue.id,
        appointmentDate: queue.appointmentDate,
      };

      const prescriptionPayload = {
        prescription: queue.prescription ?? null,
        title: queue.title ?? null,
        doctorId: queue.doctorId,
        aid: queue.aid,
        queueId: queue.id,
        appointmentDate: queue.appointmentDate,
      };

      const toInsert: Array<Partial<ClinicalRecord>> = [];

      if (queue.title || queue.notes) {
        const exists = await clinicalRepo.findOne({
          where: {
            patientId: queue.patientId,
            encounterRef: queue.id,
            recordType: ClinicalRecordType.APPOINTMENT_NOTE,
          },
          select: ['id'],
        });
        if (!exists) {
          toInsert.push({
            patientId: queue.patientId,
            sourceTenantSlug: tenantSlug,
            encounterRef: queue.id,
            occurredAt,
            recordType: ClinicalRecordType.APPOINTMENT_NOTE,
            payload: notesPayload,
          });
        }
      }

      if (queue.prescription) {
        const exists = await clinicalRepo.findOne({
          where: {
            patientId: queue.patientId,
            encounterRef: queue.id,
            recordType: ClinicalRecordType.PRESCRIPTION,
          },
          select: ['id'],
        });
        if (!exists) {
          toInsert.push({
            patientId: queue.patientId,
            sourceTenantSlug: tenantSlug,
            encounterRef: queue.id,
            occurredAt,
            recordType: ClinicalRecordType.PRESCRIPTION,
            payload: prescriptionPayload,
          });
        }
      }

      if (toInsert.length > 0) {
        await clinicalRepo.save(toInsert);
      }
    } catch (e) {
      // Non-fatal: appointment completion should succeed even if history write fails.
      this.logger.error(e);
    }

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
