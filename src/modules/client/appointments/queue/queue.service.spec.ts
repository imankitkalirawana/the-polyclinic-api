import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { REQUEST } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { Queue, QueueStatus } from './entities/queue.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { TenantAuthInitService } from '../../../tenancy/tenant-auth-init.service';
import { PaymentsService } from '../../payments/payments.service';
import { DoctorsService } from '../../doctors/doctors.service';
import { PdfService } from '../../pdf/pdf.service';
import { QrService } from '../../qr/qr.service';
import { CONNECTION } from '../../../tenancy/tenancy.symbols';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../../../../common/enums/role.enum';
import { PaymentMode } from './enums/queue.enum';
import { ActivityService } from '@/common/activity/services/activity.service';
import { ActivityLogService } from '@/common/activity/services/activity-log.service';
import { EntityType } from '@/common/activity/enums/entity-type.enum';

// Mock data factories
const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  phone: '+1234567890',
  role: Role.PATIENT,
  image: 'https://example.com/avatar.jpg',
  ...overrides,
});

const createMockPatient = (overrides = {}) => ({
  id: 'patient-123',
  gender: 'male',
  age: 30,
  user: createMockUser(),
  ...overrides,
});

const createMockDoctor = (overrides = {}) => ({
  id: 'doctor-123',
  specialization: 'General Medicine',
  code: 'DR01',
  user: createMockUser({ id: 'doctor-user-123', role: Role.DOCTOR }),
  ...overrides,
});

const createMockQueue = (overrides = {}): Partial<Queue> => ({
  id: 'queue-123',
  aid: '260117DR01001',
  status: QueueStatus.BOOKED,
  sequenceNumber: 1,
  appointmentDate: new Date('2026-01-17'),
  notes: 'Test notes',
  title: 'Consultation',
  prescription: 'Take rest',
  startedAt: new Date(),
  completedAt: null,
  completedBy: null,
  paymentMode: PaymentMode.CASH,
  completedByUser: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  patient: createMockPatient() as any,
  doctor: createMockDoctor() as any,
  bookedBy: 'user-123',
  bookedByUser: createMockUser({ role: Role.RECEPTIONIST }) as any,
  patientId: 'patient-123',
  doctorId: 'doctor-123',
  counter: { skip: 0, clockIn: 0, call: 0 },
  cancellationDetails: { by: null, remark: null } as any,
  deletedAt: null,
  ...overrides,
});

describe('QueueService', () => {
  let service: QueueService;
  let mockQueueRepository: Partial<Repository<Queue>>;
  let mockDoctorRepository: Partial<Repository<Doctor>>;
  let mockPaymentsService: Partial<PaymentsService>;
  let mockDoctorsService: Partial<DoctorsService>;
  let mockPdfService: Partial<PdfService>;
  let mockQrService: Partial<QrService>;
  let mockActivityService: Partial<ActivityService>;
  let mockActivityLogService: Partial<ActivityLogService>;
  let mockDataSource: Partial<DataSource>;
  let mockRequest: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockRequest = {
      user: {
        userId: 'user-123',
        role: Role.ADMIN,
        name: 'Admin User',
      },
      tenant: {
        slug: 'test-tenant',
      },
    };

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      manager: {
        create: jest.fn().mockImplementation((_, entity) => entity),
        save: jest.fn().mockImplementation((_, entity) => entity),
      },
    };

    mockQueueRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
    };

    mockDoctorRepository = {
      findOne: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Queue) return mockQueueRepository;
        if (entity === Doctor) return mockDoctorRepository;
        return {};
      }),
    };

    mockPaymentsService = {
      createPayment: jest.fn(),
      verifyPayment: jest.fn(),
    };

    mockDoctorsService = {
      findOne: jest.fn().mockResolvedValue(createMockDoctor()),
    };

    mockPdfService = {
      htmlToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };

    mockQrService = {
      generateBase64: jest.fn().mockResolvedValue('data:image/png;base64,...'),
    };

    mockActivityService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logDelete: jest.fn(),
      logStatusChange: jest.fn(),
    };

    mockActivityLogService = {
      getActivityLogsByEntity: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: REQUEST, useValue: mockRequest },
        { provide: CONNECTION, useValue: mockDataSource },
        { provide: TenantAuthInitService, useValue: { init: jest.fn() } },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: DoctorsService, useValue: mockDoctorsService },
        { provide: PdfService, useValue: mockPdfService },
        { provide: QrService, useValue: mockQrService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);

    // Mock internal methods
    jest.spyOn(service as any, 'ensureTablesExist').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'getRepository').mockImplementation((entity) => {
      if (entity === Queue) return mockQueueRepository;
      if (entity === Doctor) return mockDoctorRepository;
      return {};
    });
    jest.spyOn(service as any, 'getTenantSlug').mockReturnValue('test-tenant');
    (service as any).connection = mockDataSource;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkIfQueueIsBooked', () => {
    it('should return queue if already booked for same doctor and patient today', async () => {
      const mockQueue = createMockQueue();
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(mockQueue);

      const result = await service.checkIfQueueIsBooked('doctor-123', 'patient-123');

      expect(result).toEqual(mockQueue);
      expect(mockQueueRepository.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          doctorId: 'doctor-123',
          patientId: 'patient-123',
        }),
      });
    });

    it('should return null if no existing booking found', async () => {
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.checkIfQueueIsBooked('doctor-123', 'patient-123');

      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return queue when found', async () => {
      const mockQueue = createMockQueue();
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(mockQueue);

      const result = await service.findOne('queue-123');

      expect(result).toEqual(mockQueue);
      expect(mockQueueRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'queue-123' },
        withDeleted: true,
        relations: expect.any(Array),
      });
    });

    it('should throw NotFoundException when queue not found', async () => {
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return formatted list of queues', async () => {
      const mockQueues = [createMockQueue(), createMockQueue({ id: 'queue-456' })];
      (mockQueueRepository.find as jest.Mock).mockResolvedValue(mockQueues);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockQueueRepository.find).toHaveBeenCalled();
    });

    it('should filter by date when provided', async () => {
      (mockQueueRepository.find as jest.Mock).mockResolvedValue([]);

      await service.findAll('2026-01-17');

      expect(mockQueueRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update queue successfully', async () => {
      const mockQueue = createMockQueue();
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockResolvedValue(mockQueue);

      const result = await service.update('queue-123', { notes: 'Updated notes' });

      expect(result.message).toBe('Queue entry updated successfully');
      expect(mockQueueRepository.save).toHaveBeenCalled();
      expect(mockActivityService.logUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.QUEUE,
          entityId: 'queue-123',
        }),
      );
    });

    it('should validate doctor when doctorId is provided', async () => {
      const mockQueue = createMockQueue();
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockDoctorRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockQueueRepository.save as jest.Mock).mockResolvedValue(mockQueue);

      await expect(
        service.update('queue-123', { doctorId: 'invalid-doctor' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove queue successfully', async () => {
      const mockQueue = createMockQueue();
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (mockQueueRepository.remove as jest.Mock).mockResolvedValue(mockQueue);

      const result = await service.remove('queue-123');

      expect(result.message).toBe('Queue entry deleted successfully');
      expect(mockQueueRepository.remove).toHaveBeenCalledWith(mockQueue);
      expect(mockActivityService.logDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when queue not found', async () => {
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('callQueue', () => {
    it('should call queue and update status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.BOOKED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const result = await service.callQueue('queue-123');

      expect(result).toHaveProperty('status', QueueStatus.CALLED);
      expect(mockActivityService.logStatusChange).toHaveBeenCalled();
    });

    it('should increment call counter', async () => {
      const mockQueue = createMockQueue({
        status: QueueStatus.BOOKED,
        counter: { skip: 0, clockIn: 0, call: 2 },
      });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      await service.callQueue('queue-123');

      expect(mockQueue.counter.call).toBe(3);
    });

    it('should allow calling from SKIPPED status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.SKIPPED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const result = await service.callQueue('queue-123');

      expect(result).toHaveProperty('status', QueueStatus.CALLED);
    });

    it('should throw BadRequestException for invalid status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.COMPLETED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);

      await expect(service.callQueue('queue-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('skipQueue', () => {
    it('should skip queue and update status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.CALLED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const result = await service.skipQueue('queue-123');

      expect(result).toHaveProperty('status', QueueStatus.SKIPPED);
      expect(mockActivityService.logStatusChange).toHaveBeenCalled();
    });

    it('should increment skip counter', async () => {
      const mockQueue = createMockQueue({
        status: QueueStatus.CALLED,
        counter: { skip: 1, clockIn: 0, call: 1 },
      });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      await service.skipQueue('queue-123');

      expect(mockQueue.counter.skip).toBe(2);
    });

    it('should allow skipping from IN_CONSULTATION status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.IN_CONSULTATION });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const result = await service.skipQueue('queue-123');

      expect(result).toHaveProperty('status', QueueStatus.SKIPPED);
    });

    it('should throw BadRequestException for invalid status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.COMPLETED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);

      await expect(service.skipQueue('queue-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('clockIn', () => {
    it('should clock in and set status to IN_CONSULTATION', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.CALLED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const result = await service.clockIn('queue-123');

      expect(result).toHaveProperty('status', QueueStatus.IN_CONSULTATION);
      expect(mockQueue.startedAt).toBeDefined();
      expect(mockActivityService.logStatusChange).toHaveBeenCalled();
    });

    it('should increment clockIn counter', async () => {
      const mockQueue = createMockQueue({
        status: QueueStatus.CALLED,
        counter: { skip: 0, clockIn: 1, call: 1 },
      });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      await service.clockIn('queue-123');

      expect(mockQueue.counter.clockIn).toBe(2);
    });

    it('should throw BadRequestException if not called first', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.BOOKED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);

      await expect(service.clockIn('queue-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeAppointmentQueue', () => {
    const mockUser = {
      userId: 'user-123',
      role: Role.DOCTOR,
      name: 'Dr. Test',
    } as any;

    it('should complete appointment queue', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.IN_CONSULTATION });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const completeDto = {
        title: 'Completed Consultation',
        prescription: 'Take paracetamol',
      };

      const result = await service.completeAppointmentQueue(
        'queue-123',
        completeDto,
        mockUser,
      );

      expect(result).toHaveProperty('status', QueueStatus.COMPLETED);
      expect(mockQueue.completedBy).toBe('user-123');
      expect(mockQueue.completedAt).toBeDefined();
      expect(mockActivityService.logStatusChange).toHaveBeenCalled();
    });

    it('should allow updating already completed appointments', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.COMPLETED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const completeDto = {
        title: 'Updated Consultation',
        prescription: 'Updated prescription',
      };

      const result = await service.completeAppointmentQueue(
        'queue-123',
        completeDto,
        mockUser,
      );

      expect(result).toHaveProperty('status', QueueStatus.COMPLETED);
    });

    it('should throw BadRequestException for invalid status', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.BOOKED });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);

      const completeDto = {
        title: 'Consultation',
        prescription: 'Test',
      };

      await expect(
        service.completeAppointmentQueue('queue-123', completeDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPayment', () => {
    it('should cancel queue and set status to CANCELLED', async () => {
      const mockQueue = createMockQueue({ status: QueueStatus.PAYMENT_PENDING });
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const result = await service.cancelPayment('queue-123', 'Payment failed');

      expect(result.status).toBe(QueueStatus.CANCELLED);
      expect(result.cancellationDetails.remark).toBe('Payment failed');
      expect(mockActivityService.logStatusChange).toHaveBeenCalled();
    });
  });

  describe('createPayment', () => {
    it('should create payment for queue', async () => {
      const mockQueue = createMockQueue();
      const mockPayment = { id: 'payment-123', amount: 10000 };
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (mockPaymentsService.createPayment as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.createPayment('queue-123');

      expect(result).toEqual(mockPayment);
      expect(mockPaymentsService.createPayment).toHaveBeenCalledWith({
        referenceId: 'queue-123',
        amount: 10000,
        currency: expect.anything(),
        referenceType: expect.anything(),
      });
    });

    it('should throw NotFoundException if queue not found', async () => {
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.createPayment('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment and update queue status to BOOKED', async () => {
      const mockPayment = { referenceId: 'queue-123' };
      const mockQueue = createMockQueue({ status: QueueStatus.PAYMENT_PENDING });
      (mockPaymentsService.verifyPayment as jest.Mock).mockResolvedValue(mockPayment);
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (mockQueueRepository.save as jest.Mock).mockImplementation((q) => q);

      const verifyDto = {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'sig_123',
      };

      const result = await service.verifyPayment(verifyDto);

      expect(result.status).toBe(QueueStatus.BOOKED);
      expect(mockActivityService.logStatusChange).toHaveBeenCalled();
    });

    it('should throw NotFoundException if queue not found after payment verification', async () => {
      const mockPayment = { referenceId: 'non-existent' };
      (mockPaymentsService.verifyPayment as jest.Mock).mockResolvedValue(mockPayment);
      (mockQueueRepository.findOne as jest.Mock).mockResolvedValue(null);

      const verifyDto = {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'sig_123',
      };

      await expect(service.verifyPayment(verifyDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActivityLogs', () => {
    it('should return activity logs for queue', async () => {
      const mockQueue = createMockQueue();
      const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
      jest.spyOn(service, 'findOne').mockResolvedValue(mockQueue as Queue);
      (mockActivityLogService.getActivityLogsByEntity as jest.Mock).mockResolvedValue(
        mockLogs,
      );

      const result = await service.getActivityLogs('queue-123');

      expect(result).toEqual(mockLogs);
      expect(mockActivityLogService.getActivityLogsByEntity).toHaveBeenCalledWith(
        EntityType.QUEUE,
        'queue-123',
      );
    });
  });

  describe('sortQueuesByPriority (private method behavior)', () => {
    it('should sort queues correctly through getQueueForDoctor', async () => {
      // Test the sorting behavior through getQueueForDoctor
      const queues = [
        createMockQueue({
          id: 'queue-1',
          status: QueueStatus.SKIPPED,
          sequenceNumber: 1,
          counter: { skip: 1, clockIn: 0, call: 1 },
        }),
        createMockQueue({
          id: 'queue-2',
          status: QueueStatus.BOOKED,
          sequenceNumber: 2,
        }),
        createMockQueue({
          id: 'queue-3',
          status: QueueStatus.IN_CONSULTATION,
          sequenceNumber: 3,
        }),
        createMockQueue({
          id: 'queue-4',
          status: QueueStatus.CALLED,
          sequenceNumber: 4,
        }),
      ];

      (mockQueueRepository.find as jest.Mock)
        .mockResolvedValueOnce([]) // previous queues
        .mockResolvedValueOnce(queues); // next queues

      const result = await service.getQueueForDoctor({
        doctorId: 'doctor-123',
        appointmentDate: new Date('2026-01-17'),
      });

      // IN_CONSULTATION should be current (highest priority), SKIPPED should be at the end
      expect(result.current?.id).toBe('queue-3');
      // Next should contain CALLED, BOOKED, then SKIPPED
      const nextIds = result.next?.map((q: any) => q.id);
      expect(nextIds[nextIds.length - 1]).toBe('queue-1'); // SKIPPED at end
    });
  });
});
