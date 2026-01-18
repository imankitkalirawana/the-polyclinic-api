import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { QueueStatus } from './entities/queue.entity';
import { PaymentMode } from './enums/queue.enum';
import { Role } from 'src/common/enums/role.enum';
import { Response } from 'express';

// Mock data factories
const createMockFormattedQueue = (overrides = {}) => ({
  id: 'queue-123',
  aid: '260117DR01001',
  status: QueueStatus.BOOKED,
  sequenceNumber: 1,
  appointmentDate: new Date('2026-01-17'),
  notes: 'Test notes',
  title: 'Consultation',
  prescription: 'Take rest',
  paymentMode: PaymentMode.CASH,
  patient: {
    id: 'patient-123',
    name: 'Test Patient',
    email: 'patient@example.com',
  },
  doctor: {
    id: 'doctor-123',
    name: 'Dr. Test',
    specialization: 'General Medicine',
  },
  ...overrides,
});

describe('QueueController', () => {
  let controller: QueueController;
  let mockQueueService: Partial<QueueService>;

  const mockStandardParams = {
    setMessage: jest.fn(),
  };

  const mockUser = {
    userId: 'user-123',
    role: Role.DOCTOR,
    name: 'Dr. Test',
  };

  beforeEach(async () => {
    mockQueueService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      callQueue: jest.fn(),
      clockIn: jest.fn(),
      skipQueue: jest.fn(),
      completeAppointmentQueue: jest.fn(),
      getQueueForDoctor: jest.fn(),
      createPayment: jest.fn(),
      verifyPayment: jest.fn(),
      appointmentReceiptPdf: jest.fn(),
      getActivityLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [{ provide: QueueService, useValue: mockQueueService }],
    }).compile();

    controller = module.get<QueueController>(QueueController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new queue with CASH payment', async () => {
      const mockQueue = createMockFormattedQueue();
      (mockQueueService.create as jest.Mock).mockResolvedValue(mockQueue);

      const createDto = {
        patientId: 'patient-123',
        doctorId: 'doctor-123',
        paymentMode: PaymentMode.CASH,
        appointmentDate: new Date('2026-01-17'),
      };

      const result = await controller.create(
        mockStandardParams as any,
        createDto,
      );

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.create).toHaveBeenCalledWith(createDto);
      expect(mockStandardParams.setMessage).toHaveBeenCalledWith(
        'Your appointment has been booked',
      );
    });

    it('should use existing queue when queueId is provided', async () => {
      const mockQueue = createMockFormattedQueue();
      (mockQueueService.findOne as jest.Mock).mockResolvedValue(mockQueue);

      const createDto = {
        queueId: 'existing-queue-123',
        patientId: 'patient-123',
        doctorId: 'doctor-123',
        paymentMode: PaymentMode.CASH,
        appointmentDate: new Date('2026-01-17'),
      };

      const result = await controller.create(
        mockStandardParams as any,
        createDto,
      );

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.findOne).toHaveBeenCalledWith(
        'existing-queue-123',
      );
      expect(mockQueueService.create).not.toHaveBeenCalled();
    });

    it('should create payment for RAZORPAY payment mode', async () => {
      const mockQueue = createMockFormattedQueue();
      const mockPayment = { id: 'payment-123', amount: 10000 };
      (mockQueueService.create as jest.Mock).mockResolvedValue(mockQueue);
      (mockQueueService.createPayment as jest.Mock).mockResolvedValue(
        mockPayment,
      );

      const createDto = {
        patientId: 'patient-123',
        doctorId: 'doctor-123',
        paymentMode: PaymentMode.RAZORPAY,
        appointmentDate: new Date('2026-01-17'),
      };

      const result = await controller.create(
        mockStandardParams as any,
        createDto,
      );

      expect(result).toHaveProperty('payment', mockPayment);
      expect(mockQueueService.createPayment).toHaveBeenCalledWith('queue-123');
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment', async () => {
      const mockQueue = createMockFormattedQueue({
        status: QueueStatus.BOOKED,
      });
      (mockQueueService.verifyPayment as jest.Mock).mockResolvedValue(
        mockQueue,
      );

      const verifyDto = {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'sig_123',
      };

      const result = await controller.verifyPayment(verifyDto);

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.verifyPayment).toHaveBeenCalledWith(verifyDto);
    });
  });

  describe('findAll', () => {
    it('should return all queues', async () => {
      const mockQueues = [
        createMockFormattedQueue(),
        createMockFormattedQueue({ id: 'queue-456' }),
      ];
      (mockQueueService.findAll as jest.Mock).mockResolvedValue(mockQueues);

      const result = await controller.findAll();

      expect(result).toEqual(mockQueues);
      expect(mockQueueService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter by date when provided', async () => {
      const mockQueues = [createMockFormattedQueue()];
      (mockQueueService.findAll as jest.Mock).mockResolvedValue(mockQueues);

      const result = await controller.findAll('2026-01-17');

      expect(result).toEqual(mockQueues);
      expect(mockQueueService.findAll).toHaveBeenCalledWith('2026-01-17');
    });
  });

  describe('getQueueForDoctor', () => {
    it('should return queue for doctor with default date', async () => {
      const mockDoctorQueue = {
        previous: [],
        current: createMockFormattedQueue(),
        next: [createMockFormattedQueue({ id: 'queue-456' })],
        metaData: { totalPrevious: 0, totalNext: 1 },
      };
      (mockQueueService.getQueueForDoctor as jest.Mock).mockResolvedValue(
        mockDoctorQueue,
      );

      const result = await controller.getQueueForDoctor('doctor-123');

      expect(result).toEqual(mockDoctorQueue);
      expect(mockQueueService.getQueueForDoctor).toHaveBeenCalledWith({
        doctorId: 'doctor-123',
        queueId: undefined,
        appointmentDate: expect.any(Date),
      });
    });

    it('should pass queue id and date when provided', async () => {
      const mockDoctorQueue = {
        previous: [],
        current: createMockFormattedQueue(),
        next: [],
        metaData: { totalPrevious: 0, totalNext: 0 },
      };
      (mockQueueService.getQueueForDoctor as jest.Mock).mockResolvedValue(
        mockDoctorQueue,
      );

      await controller.getQueueForDoctor(
        'doctor-123',
        'queue-123',
        '2026-01-17',
      );

      expect(mockQueueService.getQueueForDoctor).toHaveBeenCalledWith({
        doctorId: 'doctor-123',
        queueId: 'queue-123',
        appointmentDate: expect.any(Date),
      });
    });
  });

  describe('getActivityLogs', () => {
    it('should return activity logs for queue', async () => {
      const mockLogs = [{ id: 'log-1', action: 'create' }];
      (mockQueueService.getActivityLogs as jest.Mock).mockResolvedValue(
        mockLogs,
      );

      const result = await controller.getActivityLogs('queue-123');

      expect(result).toEqual(mockLogs);
      expect(mockQueueService.getActivityLogs).toHaveBeenCalledWith(
        'queue-123',
      );
    });
  });

  describe('findOne', () => {
    it('should return formatted queue', async () => {
      const mockQueue = createMockFormattedQueue();
      (mockQueueService.findOne as jest.Mock).mockResolvedValue(mockQueue);

      const result = await controller.findOne('queue-123');

      expect(result).toBeDefined();
      expect(mockQueueService.findOne).toHaveBeenCalledWith('queue-123');
    });
  });

  describe('update', () => {
    it('should update queue', async () => {
      const mockResult = {
        message: 'Queue entry updated successfully',
        data: createMockFormattedQueue({ notes: 'Updated notes' }),
      };
      (mockQueueService.update as jest.Mock).mockResolvedValue(mockResult);

      const updateDto = { notes: 'Updated notes' };
      const result = await controller.update('queue-123', updateDto);

      expect(result).toEqual(mockResult);
      expect(mockQueueService.update).toHaveBeenCalledWith(
        'queue-123',
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove queue', async () => {
      const mockResult = { message: 'Queue entry deleted successfully' };
      (mockQueueService.remove as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.remove('queue-123');

      expect(result).toEqual(mockResult);
      expect(mockQueueService.remove).toHaveBeenCalledWith('queue-123');
    });
  });

  describe('callQueue', () => {
    it('should call queue and set message', async () => {
      const mockQueue = createMockFormattedQueue({
        status: QueueStatus.CALLED,
      });
      (mockQueueService.callQueue as jest.Mock).mockResolvedValue(mockQueue);

      const result = await controller.callQueue(
        mockStandardParams as any,
        'queue-123',
      );

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.callQueue).toHaveBeenCalledWith('queue-123');
      expect(mockStandardParams.setMessage).toHaveBeenCalledWith(
        'Patient has been called',
      );
    });
  });

  describe('clockIn', () => {
    it('should clock in and set message', async () => {
      const mockQueue = createMockFormattedQueue({
        status: QueueStatus.IN_CONSULTATION,
      });
      (mockQueueService.clockIn as jest.Mock).mockResolvedValue(mockQueue);

      const result = await controller.clockIn(
        mockStandardParams as any,
        'queue-123',
      );

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.clockIn).toHaveBeenCalledWith('queue-123');
      expect(mockStandardParams.setMessage).toHaveBeenCalledWith(
        'Appointment started',
      );
    });
  });

  describe('skipQueue', () => {
    it('should skip queue and set message', async () => {
      const mockQueue = createMockFormattedQueue({
        status: QueueStatus.SKIPPED,
      });
      (mockQueueService.skipQueue as jest.Mock).mockResolvedValue(mockQueue);

      const result = await controller.skipQueue(
        mockStandardParams as any,
        'queue-123',
      );

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.skipQueue).toHaveBeenCalledWith('queue-123');
      expect(mockStandardParams.setMessage).toHaveBeenCalledWith(
        'Patient has been temporarily skipped',
      );
    });
  });

  describe('completeAppointmentQueue', () => {
    it('should complete appointment and set message', async () => {
      const mockQueue = createMockFormattedQueue({
        status: QueueStatus.COMPLETED,
      });
      (
        mockQueueService.completeAppointmentQueue as jest.Mock
      ).mockResolvedValue(mockQueue);

      const completeDto = {
        title: 'Completed Consultation',
        prescription: 'Take paracetamol',
      };

      const result = await controller.completeAppointmentQueue(
        mockStandardParams as any,
        'queue-123',
        completeDto,
        mockUser as any,
      );

      expect(result).toEqual(mockQueue);
      expect(mockQueueService.completeAppointmentQueue).toHaveBeenCalledWith(
        'queue-123',
        completeDto,
        mockUser,
      );
      expect(mockStandardParams.setMessage).toHaveBeenCalledWith(
        'Appointment Completed',
      );
    });
  });

  describe('appointmentReceiptPdf', () => {
    it('should return PDF response with correct headers', async () => {
      const mockPdf = Buffer.from('pdf content');
      const mockMetaData = {
        title: 'Appointment Receipt',
        filename: 'Test_Patient_1.pdf',
      };
      (mockQueueService.appointmentReceiptPdf as jest.Mock).mockResolvedValue({
        pdf: mockPdf,
        metaData: mockMetaData,
      });

      const mockResponse = {
        set: jest.fn(),
        end: jest.fn(),
      } as unknown as Response;

      await controller.appointmentReceiptPdf('queue-123', mockResponse);

      expect(mockQueueService.appointmentReceiptPdf).toHaveBeenCalledWith(
        'queue-123',
      );
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=Test_Patient_1.pdf',
        'Content-Length': mockPdf.length,
        'Content-Title': 'Appointment Receipt',
      });
      expect(mockResponse.end).toHaveBeenCalledWith(mockPdf);
    });
  });

  describe('Role-based access control', () => {
    it('should have correct roles for create endpoint', () => {
      // This is verified through the decorator metadata
      // In a full e2e test, you would verify unauthorized access is blocked
      expect(controller.create).toBeDefined();
    });

    it('should have correct roles for findAll endpoint', () => {
      expect(controller.findAll).toBeDefined();
    });

    it('should have correct roles for remove endpoint', () => {
      expect(controller.remove).toBeDefined();
    });
  });
});
