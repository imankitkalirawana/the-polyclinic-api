import './types';
import { executeScript } from './script-runner.util';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Company } from '@/auth/entities/company.entity';
import { getTenantConnection } from 'src/common/db/tenant-connection';
import {
  Gender,
  Patient as PublicPatient,
} from '@/public/patients/entities/patient.entity';
import {
  PatientTenantMembership,
  PatientTenantMembershipStatus,
} from '@/public/patients/entities/patient-tenant-membership.entity';
import {
  ClinicalRecord,
  ClinicalRecordType,
} from '@/public/clinical/entities/clinical-record.entity';
import {
  Queue,
  QueueStatus,
} from '@/client/appointments/queue/entities/queue.entity';

const CHUNK_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run(app: INestApplicationContext) {
  const publicDataSource = app.get(DataSource);
  const companyRepo = publicDataSource.getRepository(Company);
  const publicPatientRepo = publicDataSource.getRepository(PublicPatient);
  const membershipRepo = publicDataSource.getRepository(
    PatientTenantMembership,
  );
  const clinicalRepo = publicDataSource.getRepository(ClinicalRecord);

  const companies = await companyRepo.find({
    where: { deleted: false },
  });

  const tenantSlugs = companies
    .map((c) => (c.schema ?? '').trim().toLowerCase())
    .filter(Boolean);

  console.log(`Found ${tenantSlugs.length} tenant schemas to process.`);

  for (const tenantSlug of tenantSlugs) {
    console.log(`\n=== Tenant: ${tenantSlug} ===`);
    const tenantDs = await getTenantConnection(tenantSlug);

    const tenantQueueRepo = tenantDs.getRepository(Queue);

    let tenantPatients: Array<{
      id: string;
      user_id: string;
      gender: Gender;
      dob: Date | null;
      address: string | null;
      deletedAt: Date | null;
    }> = [];
    try {
      tenantPatients = await tenantDs.query(
        `SELECT id, user_id, gender, dob, address, "deletedAt" as "deletedAt" FROM "${tenantSlug}"."patients"`,
      );
    } catch {
      console.log(
        `Skipping tenant ${tenantSlug}: patients table not found or not accessible`,
      );
      continue;
    }
    console.log(`Tenant patients: ${tenantPatients.length}`);

    const idMap = new Map<string, string>(); // oldTenantPatientId -> publicPatientId

    for (const tp of tenantPatients) {
      // 1) Merge/create public patient keyed by user_id
      let pp = await publicPatientRepo.findOne({
        where: { user_id: tp.user_id },
      });

      if (!pp) {
        pp = publicPatientRepo.create({
          user_id: tp.user_id,
          gender: tp.gender,
          dob: tp.dob ?? null,
          address: tp.address ?? null,
          deletedAt: null,
        } as Partial<PublicPatient>);
        pp = await publicPatientRepo.save(pp);
      } else {
        // Merge: only fill missing fields
        let changed = false;
        if (!pp.gender && tp.gender) {
          pp.gender = tp.gender;
          changed = true;
        }
        if (!pp.dob && tp.dob) {
          pp.dob = tp.dob;
          changed = true;
        }
        if (!pp.address && tp.address) {
          pp.address = tp.address;
          changed = true;
        }
        if (changed) {
          pp = await publicPatientRepo.save(pp);
        }
      }

      idMap.set(tp.id, pp.id);

      // 2) Create/merge membership boundary for this tenant
      const desiredStatus = tp.deletedAt
        ? PatientTenantMembershipStatus.REVOKED
        : PatientTenantMembershipStatus.ACTIVE;

      const existingMembership = await membershipRepo.findOne({
        where: { patientId: pp.id, tenantSlug },
      });

      if (!existingMembership) {
        await membershipRepo.save(
          membershipRepo.create({
            patientId: pp.id,
            tenantSlug,
            status: desiredStatus,
            shareMedicalHistory: true,
          }),
        );
      } else if (existingMembership.status !== desiredStatus) {
        existingMembership.status = desiredStatus;
        await membershipRepo.save(existingMembership);
      }
    }

    // 3) Remap appointment_queue.patientId to public patient ids
    const pairs = [...idMap.entries()].map(([oldId, newId]) => ({
      oldId,
      newId,
    }));
    console.log(
      `Remapping appointment_queue.patientId for ${pairs.length} patients...`,
    );

    for (const batch of chunk(pairs, CHUNK_SIZE)) {
      // Build VALUES list: (oldId, newId)
      const valuesSql: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const row of batch) {
        valuesSql.push(`($${p++}, $${p++})`);
        params.push(row.oldId, row.newId);
      }

      const sql = `
        UPDATE "${tenantSlug}"."appointment_queue" q
        SET "patientId" = m.new_id
        FROM (VALUES ${valuesSql.join(', ')}) AS m(old_id, new_id)
        WHERE q."patientId" = m.old_id
      `;
      await tenantDs.query(sql, params);
    }

    // 4) Backfill public clinical records from completed queues
    const completedQueues = await tenantQueueRepo.find({
      where: { status: QueueStatus.COMPLETED },
      withDeleted: true,
    });
    console.log(`Completed queues: ${completedQueues.length}`);

    let inserted = 0;
    for (const q of completedQueues) {
      const publicPatientId = idMap.get(q.patientId) ?? q.patientId;
      const occurredAt =
        q.completedAt ?? q.updatedAt ?? q.createdAt ?? new Date();

      if (q.title || q.notes) {
        const exists = await clinicalRepo.findOne({
          where: {
            patientId: publicPatientId,
            encounterRef: q.id,
            recordType: ClinicalRecordType.APPOINTMENT_NOTE,
          },
          select: ['id'],
        });
        if (!exists) {
          await clinicalRepo.save(
            clinicalRepo.create({
              patientId: publicPatientId,
              sourceTenantSlug: tenantSlug,
              encounterRef: q.id,
              occurredAt,
              recordType: ClinicalRecordType.APPOINTMENT_NOTE,
              payload: {
                title: q.title ?? null,
                notes: q.notes ?? null,
                doctorId: q.doctorId,
                aid: q.aid,
                queueId: q.id,
                appointmentDate: q.appointmentDate,
              },
            }),
          );
          inserted++;
        }
      }

      if (q.prescription) {
        const exists = await clinicalRepo.findOne({
          where: {
            patientId: publicPatientId,
            encounterRef: q.id,
            recordType: ClinicalRecordType.PRESCRIPTION,
          },
          select: ['id'],
        });
        if (!exists) {
          await clinicalRepo.save(
            clinicalRepo.create({
              patientId: publicPatientId,
              sourceTenantSlug: tenantSlug,
              encounterRef: q.id,
              occurredAt,
              recordType: ClinicalRecordType.PRESCRIPTION,
              payload: {
                prescription: q.prescription ?? null,
                title: q.title ?? null,
                doctorId: q.doctorId,
                aid: q.aid,
                queueId: q.id,
                appointmentDate: q.appointmentDate,
              },
            }),
          );
          inserted++;
        }
      }
    }

    console.log(`Inserted clinical records: ${inserted}`);
  }

  console.log('\n✅ Migration/backfill script completed.');
}

executeScript(run);
