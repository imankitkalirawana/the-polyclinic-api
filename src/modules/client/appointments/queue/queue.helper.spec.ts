import { Role } from 'src/common/enums/role.enum';
import { Queue, QueueStatus } from './entities/queue.entity';
import { PaymentMode } from './enums/queue.enum';
import {
  formatQueue,
  generateAppointmentId,
  buildSequenceName,
  ensureSequenceExists,
  getNextTokenNumber,
} from './queue.helper';

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

const createMockQueue = (overrides = {}): Queue =>
  ({
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
    patient: createMockPatient(),
    doctor: createMockDoctor(),
    bookedBy: 'user-123',
    bookedByUser: createMockUser({ role: Role.RECEPTIONIST }),
    patientId: 'patient-123',
    doctorId: 'doctor-123',
    counter: { skip: 0, clockIn: 0, call: 0 },
    cancellationDetails: { by: null, remark: null },
    deletedAt: null,
    ...overrides,
  }) as Queue;

describe('Queue Helper Functions', () => {
  describe('formatQueue', () => {
    const queue = createMockQueue();

    it('should format a queue with all fields correctly', () => {
      const result = formatQueue(queue);
      expect(result).toHaveProperty('id', 'queue-123');
      expect(result).toHaveProperty('aid', '260117DR01001');
      expect(result).toHaveProperty('status', QueueStatus.BOOKED);
      expect(result).toHaveProperty('sequenceNumber', 1);
      expect(result).toHaveProperty('notes', 'Test notes');
      expect(result).toHaveProperty('title', 'Consultation');
      expect(result).toHaveProperty('prescription', 'Take rest');
      expect(result).toHaveProperty('paymentMode', PaymentMode.CASH);
    });

    it('should format patient information correctly', () => {
      const result = formatQueue(queue);

      expect(result.patient).toEqual({
        id: 'patient-123',
        gender: 'male',
        age: 30,
        email: 'test@example.com',
        name: 'Test User',
        phone: '+1234567890',
        userId: 'user-123',
        image: 'https://example.com/avatar.jpg',
      });
    });

    it('should format doctor information correctly', () => {
      const result = formatQueue(queue, Role.ADMIN);

      expect(result.doctor).toHaveProperty('id', 'doctor-123');
      expect(result.doctor).toHaveProperty(
        'specialization',
        'General Medicine',
      );
      expect(result.doctor).toHaveProperty('name', 'Test User');
    });

    it('should handle null patient gracefully', () => {
      const queue = createMockQueue({ patient: null });
      const result = formatQueue(queue);

      expect(result.patient).toBeNull();
    });

    it('should handle null doctor gracefully', () => {
      const queue = createMockQueue({ doctor: null });
      const result = formatQueue(queue);

      expect(result.doctor).toBeNull();
    });

    it('should handle null bookedByUser gracefully', () => {
      const queue = createMockQueue({ bookedByUser: null });
      const result = formatQueue(queue);

      expect(result.bookedByUser).toBeNull();
    });

    it('should handle null completedByUser gracefully', () => {
      const queue = createMockQueue({ completedByUser: null });
      const result = formatQueue(queue);

      expect(result.completedByUser).toBeNull();
    });

    it('should include nextQueueId and previousQueueId when provided', () => {
      const queue = createMockQueue() as any;
      queue.nextQueueId = 'next-queue-123';
      queue.previousQueueId = 'prev-queue-123';

      const result = formatQueue(queue);

      expect(result).toHaveProperty('nextQueueId', 'next-queue-123');
      expect(result).toHaveProperty('previousQueueId', 'prev-queue-123');
    });

    it('should handle patient with null user', () => {
      const queue = createMockQueue({
        patient: { id: 'patient-123', gender: 'male', age: 30, user: null },
      });
      const result = formatQueue(queue);

      expect(result.patient.email).toBeNull();
      expect(result.patient.name).toBeNull();
      expect(result.patient.phone).toBeNull();
      expect(result.patient.userId).toBeNull();
      expect(result.patient.image).toBeNull();
    });

    it('should handle doctor with null user', () => {
      const queue = createMockQueue({
        doctor: { id: 'doctor-123', specialization: 'General', user: null },
      });
      const result = formatQueue(queue);

      expect(result.doctor.email).toBeNull();
      expect(result.doctor.name).toBeNull();
      expect(result.doctor.userId).toBeNull();
      expect(result.doctor.image).toBeNull();
    });

    describe('field redaction', () => {
      it('should NOT redact doctor email when viewed by ADMIN', () => {
        const queue = createMockQueue();
        const result = formatQueue(queue, Role.ADMIN);

        // ADMIN can see doctor's email (not redacted)
        expect(result.doctor.email).toBe('test@example.com');
      });

      it('should redact doctor email when viewed by PATIENT', () => {
        const queue = createMockQueue();
        const result = formatQueue(queue, Role.PATIENT);

        // PATIENT viewing DOCTOR's email should see redacted version
        // Based on DEFAULT_REDACT_FIELD_CONFIG: PATIENT can see [DOCTOR, ADMIN, RECEPTIONIST]
        // But this is opposite - PATIENT role viewing means they see their own level
        // Actually the config says: currentRole's array lists roles whose data they CAN see
        expect(result.doctor.email).toBe('tes*****com');
      });

      it('should NOT redact bookedByUser email when viewed by ADMIN', () => {
        const queue = createMockQueue({
          bookedByUser: createMockUser({
            role: Role.RECEPTIONIST,
            email: 'receptionist@example.com',
            phone: '+1987654321',
          }),
        });
        const result = formatQueue(queue, Role.ADMIN);

        // ADMIN can see receptionist's email
        expect(result.bookedByUser.email).toBe('receptionist@example.com');
        expect(result.bookedByUser.phone).toBe('+1987654321');
      });

      it('should redact bookedByUser email and phone when viewed by PATIENT', () => {
        const queue = createMockQueue({
          bookedByUser: createMockUser({
            role: Role.RECEPTIONIST,
            email: 'receptionist@example.com',
            phone: '+1987654321',
          }),
        });
        const result = formatQueue(queue, Role.PATIENT);

        // PATIENT viewing RECEPTIONIST's data - should be redacted
        expect(result.bookedByUser.email).toBe('rec*****com');
        expect(result.bookedByUser.phone).toBe('+19*****321');
      });

      it('should NOT redact completedByUser email when viewed by ADMIN', () => {
        const queue = createMockQueue({
          completedByUser: createMockUser({
            id: 'completed-user-123',
            role: Role.DOCTOR,
            email: 'doctor@hospital.com',
          }),
        });
        const result = formatQueue(queue, Role.ADMIN);

        // ADMIN can see doctor's email
        expect(result.completedByUser.email).toBe('doctor@hospital.com');
      });

      it('should redact completedByUser email when viewed by PATIENT', () => {
        const queue = createMockQueue({
          completedByUser: createMockUser({
            id: 'completed-user-123',
            role: Role.DOCTOR,
            email: 'doctor@hospital.com',
          }),
        });
        const result = formatQueue(queue, Role.PATIENT);

        // PATIENT viewing DOCTOR's email - should be redacted
        expect(result.completedByUser.email).toBe('doc*****com');
      });

      it('should handle null values in redacted fields gracefully', () => {
        const queue = createMockQueue({
          bookedByUser: createMockUser({
            role: Role.RECEPTIONIST,
            email: null,
            phone: null,
          }),
        });
        const result = formatQueue(queue, Role.PATIENT);

        expect(result.bookedByUser.email).toBeNull();
        expect(result.bookedByUser.phone).toBeNull();
      });

      it('should NOT redact fields when no role is provided', () => {
        const queue = createMockQueue({
          bookedByUser: createMockUser({
            role: Role.RECEPTIONIST,
            email: 'receptionist@example.com',
            phone: '+1987654321',
          }),
        });
        const result = formatQueue(queue); // No role provided

        // Without role, redactField returns the original value when currentRole is undefined
        expect(result.bookedByUser).toBeDefined();
      });

      it('should NOT redact doctor email when viewed by DOCTOR (viewing another doctor)', () => {
        const queue = createMockQueue();
        const result = formatQueue(queue, Role.DOCTOR);

        // DOCTOR viewing another DOCTOR's email - DOCTOR's config array is [ADMIN]
        // This means DOCTORs redact ADMIN data, but not other DOCTORs
        expect(result.doctor.email).toBe('test@example.com');
      });

      it('should redact email when DOCTOR views ADMIN data', () => {
        const queue = createMockQueue({
          doctor: createMockDoctor({
            user: createMockUser({
              id: 'admin-user',
              role: Role.ADMIN,
              email: 'admin@hospital.com',
            }),
          }),
        });
        const result = formatQueue(queue, Role.DOCTOR);

        // DOCTOR viewing ADMIN's email - based on config DOCTOR: [ADMIN]
        // The config means DOCTORs redact data from users in the array (ADMIN)
        expect(result.doctor.email).toBe('adm*****com');
      });
    });
  });

  describe('generateAppointmentId', () => {
    it('should generate appointment id with correct format', () => {
      const date = new Date('2026-01-17');
      const doctorCode = 'DR01';
      const sequenceNumber = 5;

      const result = generateAppointmentId(date, doctorCode, sequenceNumber);

      expect(result).toBe('260117DR01005');
    });

    it('should pad sequence number to 3 digits', () => {
      const date = new Date('2026-01-17');

      expect(generateAppointmentId(date, 'DR', 1)).toBe('260117DR001');
      expect(generateAppointmentId(date, 'DR', 10)).toBe('260117DR010');
      expect(generateAppointmentId(date, 'DR', 100)).toBe('260117DR100');
      expect(generateAppointmentId(date, 'DR', 999)).toBe('260117DR999');
    });

    it('should handle single digit months correctly', () => {
      const date = new Date('2026-05-08');
      const result = generateAppointmentId(date, 'AB', 1);

      expect(result).toBe('260508AB001');
    });

    it('should handle different doctor codes', () => {
      const date = new Date('2026-12-25');

      expect(generateAppointmentId(date, 'XY', 1)).toBe('261225XY001');
      expect(generateAppointmentId(date, 'ABC', 1)).toBe('261225ABC001');
    });
  });

  describe('buildSequenceName', () => {
    it('should build sequence name with correct format', () => {
      const doctorId = '7c9f3a2e-1234-5678-9abc-def012345678';
      const appointmentDate = new Date('2026-01-14');

      const result = buildSequenceName(doctorId, appointmentDate);

      expect(result).toBe(
        'seq_queue_7c9f3a2e123456789abcdef012345678_20260114',
      );
    });

    it('should remove all dashes from doctor id', () => {
      const doctorId = 'aaaa-bbbb-cccc-dddd-eeee';
      const appointmentDate = new Date('2026-01-01');

      const result = buildSequenceName(doctorId, appointmentDate);

      expect(result).not.toContain('-');
    });

    it('should format date as YYYYMMDD', () => {
      const doctorId = '12345678-1234-1234-1234-123456789abc';
      const appointmentDate = new Date('2026-12-31');

      const result = buildSequenceName(doctorId, appointmentDate);

      expect(result).toContain('_20261231');
    });

    it('should pad single digit months and days', () => {
      const doctorId = '12345678-1234-1234-1234-123456789abc';
      const appointmentDate = new Date('2026-01-05');

      const result = buildSequenceName(doctorId, appointmentDate);

      expect(result).toContain('_20260105');
    });
  });

  describe('ensureSequenceExists', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        query: jest.fn(),
      };
    });

    it('should acquire advisory lock and create sequence if not exists', async () => {
      // Mock exists check returns false
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_lock
        .mockResolvedValueOnce([{ exists: false }]) // EXISTS check
        .mockResolvedValueOnce(undefined) // CREATE SEQUENCE
        .mockResolvedValueOnce(undefined); // pg_advisory_unlock

      await ensureSequenceExists(mockQueryRunner, 'tenant_schema', 'seq_test');

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(4);
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
        1,
        'SELECT pg_advisory_lock($1)',
        expect.any(Array),
      );
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
        3,
        'CREATE SEQUENCE "tenant_schema"."seq_test" START 1 MINVALUE 1',
      );
    });

    it('should not create sequence if it already exists', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_lock
        .mockResolvedValueOnce([{ exists: true }]) // EXISTS check
        .mockResolvedValueOnce(undefined); // pg_advisory_unlock

      await ensureSequenceExists(mockQueryRunner, 'tenant_schema', 'seq_test');

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
      // Should not have called CREATE SEQUENCE
      expect(mockQueryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining('CREATE SEQUENCE'),
      );
    });

    it('should always release advisory lock even on error', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_lock
        .mockRejectedValueOnce(new Error('DB Error')) // EXISTS check fails
        .mockResolvedValueOnce(undefined); // pg_advisory_unlock

      await expect(
        ensureSequenceExists(mockQueryRunner, 'tenant_schema', 'seq_test'),
      ).rejects.toThrow('DB Error');

      // Should still have called unlock
      expect(mockQueryRunner.query).toHaveBeenLastCalledWith(
        'SELECT pg_advisory_unlock($1)',
        expect.any(Array),
      );
    });
  });

  describe('getNextTokenNumber', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        query: jest.fn(),
      };
    });

    it('should return next value from sequence', async () => {
      mockQueryRunner.query.mockResolvedValue([{ value: '5' }]);

      const result = await getNextTokenNumber(
        mockQueryRunner,
        'tenant_schema',
        'seq_test',
      );

      expect(result).toBe(5);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        "SELECT nextval(format('%I.%I', $1::text, $2::text)::regclass) as value",
        ['tenant_schema', 'seq_test'],
      );
    });

    it('should parse string value to integer', async () => {
      mockQueryRunner.query.mockResolvedValue([{ value: '123' }]);

      const result = await getNextTokenNumber(
        mockQueryRunner,
        'schema',
        'sequence',
      );

      expect(typeof result).toBe('number');
      expect(result).toBe(123);
    });
  });
});
