import { Role } from 'src/common/enums/role.enum';
import { Queue } from './entities/queue.entity';
import { redactField } from 'src/common/utils/redact.util';

interface FormattedQueue extends Queue {
  nextQueueId?: string;
  previousQueueId?: string;
}

export function formatQueue(queue: FormattedQueue, role?: Role | null) {
  return {
    id: queue.id,
    aid: queue.aid,
    status: queue.status,
    sequenceNumber: queue.sequenceNumber,
    appointmentDate: queue.appointmentDate,
    notes: queue.notes,
    title: queue.title,
    prescription: queue.prescription,
    startedAt: queue.startedAt,
    completedAt: queue.completedAt,
    completedBy: queue.completedBy,
    paymentMode: queue.paymentMode,
    completedByUser: queue.completedByUser
      ? {
          id: queue.completedByUser.id,
          email: redactField({
            value: queue.completedByUser.email,
            currentRole: role,
            targetRole: queue.completedByUser.role,
          }),
          name: queue.completedByUser.name,
        }
      : null,
    createdAt: queue.createdAt,
    updatedAt: queue.updatedAt,
    nextQueueId: queue.nextQueueId,
    previousQueueId: queue.previousQueueId,

    patient: queue.patient
      ? {
          id: queue.patient.id,
          gender: queue.patient.gender,
          age: queue.patient.age,
          email: queue.patient.user?.email ?? null,
          name: queue.patient.user?.name ?? null,
          phone: queue.patient.user?.phone ?? null,
          userId: queue.patient.user?.id ?? null,
          image: queue.patient.user?.image ?? null,
        }
      : null,

    doctor: queue.doctor
      ? {
          id: queue.doctor.id,
          specialization: queue.doctor.specialization,
          email: redactField({
            value: queue.doctor.user?.email ?? null,
            currentRole: role,
            targetRole: queue.doctor.user?.role,
          }),
          name: queue.doctor.user?.name ?? null,
          userId: queue.doctor.user?.id ?? null,
          image: queue.doctor.user?.image ?? null,
        }
      : null,

    bookedByUser: queue.bookedByUser
      ? {
          id: queue.bookedByUser.id,
          email: redactField({
            value: queue.bookedByUser.email,
            currentRole: role,
            targetRole: queue.bookedByUser.role,
          }),
          name: queue.bookedByUser.name,
          phone: redactField({
            value: queue.bookedByUser.phone,
            currentRole: role,
            targetRole: queue.bookedByUser.role,
          }),
          image: queue.bookedByUser.image ?? null,
        }
      : null,
  };
}

export function generateAppointmentId(
  date: Date,
  doctorCode: string,
  sequenceNumber: number,
) {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}${doctorCode}${sequenceNumber.toString().padStart(3, '0')}`;
}

/**
 * Builds a safe PostgreSQL sequence name for doctor-wise, day-wise token generation
 * Format: seq_queue_<doctorIdWithoutDashes>_<YYYYMMDD>
 * Example: seq_queue_7c9f3a2e20260114
 */
export function buildSequenceName(
  doctorId: string,
  appointmentDate: Date,
): string {
  // Remove dashes from UUID
  const doctorIdWithoutDashes = doctorId.replace(/-/g, '');

  // Format date as YYYYMMDD
  const year = appointmentDate.getFullYear();
  const month = (appointmentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = appointmentDate.getDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  return `seq_queue_${doctorIdWithoutDashes}_${dateStr}`;
}

/**
 * Ensures a PostgreSQL sequence exists for the given doctor and appointment date.
 * Uses pg_advisory_lock to prevent race conditions during sequence creation.
 * @param queryRunner TypeORM QueryRunner instance
 * @param schemaName The schema name (tenant slug)
 * @param sequenceName The sequence name to ensure exists
 */
export async function ensureSequenceExists(
  queryRunner: any,
  schemaName: string,
  sequenceName: string,
): Promise<void> {
  // Use advisory lock based on sequence name hash to prevent concurrent creation
  const lockId = hashString(`${schemaName}.${sequenceName}`);

  try {
    // Acquire advisory lock
    await queryRunner.query(`SELECT pg_advisory_lock($1)`, [lockId]);

    // Check if sequence exists in the specified schema
    const result = await queryRunner.query(
      `SELECT EXISTS (
        SELECT 1 FROM pg_sequences WHERE schemaname = $1 AND sequencename = $2
      )`,
      [schemaName, sequenceName],
    );

    const exists = result[0]?.exists ?? false;

    if (!exists) {
      // Create sequence starting from 1 in the specified schema
      await queryRunner.query(
        `CREATE SEQUENCE "${schemaName}"."${sequenceName}" START 1 MINVALUE 1`,
      );
    }
  } finally {
    // Always release the advisory lock
    await queryRunner.query(`SELECT pg_advisory_unlock($1)`, [lockId]);
  }
}

/**
 * Gets the next token number from the sequence using nextval()
 * @param queryRunner TypeORM QueryRunner instance
 * @param schemaName The schema name (tenant slug)
 * @param sequenceName The sequence name to get next value from
 * @returns The next sequence number
 */
export async function getNextTokenNumber(
  queryRunner: any,
  schemaName: string,
  sequenceName: string,
): Promise<number> {
  // Use PostgreSQL's format() function with %I for safe identifier quoting
  // %I properly quotes identifiers and prevents SQL injection
  // Explicitly cast parameters to text so PostgreSQL can determine the type
  const result = await queryRunner.query(
    `SELECT nextval(format('%I.%I', $1::text, $2::text)::regclass) as value`,
    [schemaName, sequenceName],
  );
  return parseInt(result[0].value, 10);
}

/**
 * Simple hash function to convert string to integer for pg_advisory_lock
 * Uses djb2 algorithm
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
