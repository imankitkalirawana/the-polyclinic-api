import './types';
import { executeScript } from './script-runner.util';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Company } from '@/auth/entities/company.entity';
import { getTenantConnection } from 'src/common/db/tenant-connection';
import { Doctor as PublicDoctor } from '@/public/doctors/entities/doctor.entity';
import {
  DoctorTenantMembership,
  DoctorTenantMembershipStatus,
} from '@/public/doctors/entities/doctor-tenant-membership.entity';
import { Queue } from '@/client/appointments/queue/entities/queue.entity';

const CHUNK_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run(app: INestApplicationContext) {
  const publicDataSource = app.get(DataSource);
  const companyRepo = publicDataSource.getRepository(Company);
  const publicDoctorRepo = publicDataSource.getRepository(PublicDoctor);
  const membershipRepo = publicDataSource.getRepository(DoctorTenantMembership);

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

    let tenantDoctors: Array<{
      id: string;
      user_id: string;
      code: string | null;
      specialization: string | null;
      designation: string | null;
      departments: string[] | null;
      experience: number | null;
      education: string | null;
      biography: string | null;
      seating: string | null;
      deletedAt: Date | null;
    }> = [];

    try {
      tenantDoctors = await tenantDs.query(
        `SELECT id, user_id, code, specialization, designation, departments, experience, education, biography, seating, "deletedAt" as "deletedAt" FROM "${tenantSlug}"."doctors"`,
      );
    } catch {
      console.log(
        `Skipping tenant ${tenantSlug}: doctors table not found or not accessible`,
      );
      continue;
    }

    console.log(`Tenant doctors: ${tenantDoctors.length}`);

    const idMap = new Map<string, string>(); // oldTenantDoctorId -> publicDoctorId

    for (const td of tenantDoctors) {
      let pd = await publicDoctorRepo.findOne({
        where: { user_id: td.user_id },
      });

      if (!pd) {
        pd = publicDoctorRepo.create({
          user_id: td.user_id,
          specialization: td.specialization ?? null,
          experience: td.experience ?? null,
          education: td.education ?? null,
          biography: td.biography ?? null,
          deletedAt: null,
        } as Partial<PublicDoctor>);
        pd = await publicDoctorRepo.save(pd);
      } else {
        let changed = false;
        if (!pd.specialization && td.specialization) {
          pd.specialization = td.specialization;
          changed = true;
        }
        if (
          (pd.experience === null || pd.experience === undefined) &&
          td.experience
        ) {
          pd.experience = td.experience;
          changed = true;
        }
        if (!pd.education && td.education) {
          pd.education = td.education;
          changed = true;
        }
        if (!pd.biography && td.biography) {
          pd.biography = td.biography;
          changed = true;
        }
        if (changed) pd = await publicDoctorRepo.save(pd);
      }

      idMap.set(td.id, pd.id);

      const desiredStatus = td.deletedAt
        ? DoctorTenantMembershipStatus.REVOKED
        : DoctorTenantMembershipStatus.ACTIVE;

      const existingMembership = await membershipRepo.findOne({
        where: { doctorId: pd.id, tenantSlug },
      });

      if (!existingMembership) {
        await membershipRepo.save(
          membershipRepo.create({
            doctorId: pd.id,
            tenantSlug,
            status: desiredStatus,
            code: td.code ?? null,
            designation: td.designation ?? null,
            seating: td.seating ?? null,
            departments: td.departments ?? null,
          }),
        );
      } else {
        let changed = false;
        if (existingMembership.status !== desiredStatus) {
          existingMembership.status = desiredStatus;
          changed = true;
        }
        // Only fill missing tenant fields
        if (!existingMembership.code && td.code) {
          existingMembership.code = td.code;
          changed = true;
        }
        if (!existingMembership.designation && td.designation) {
          existingMembership.designation = td.designation;
          changed = true;
        }
        if (!existingMembership.seating && td.seating) {
          existingMembership.seating = td.seating;
          changed = true;
        }
        if (
          (!existingMembership.departments ||
            existingMembership.departments.length === 0) &&
          td.departments &&
          td.departments.length > 0
        ) {
          existingMembership.departments = td.departments;
          changed = true;
        }
        if (changed) await membershipRepo.save(existingMembership);
      }
    }

    // Remap appointment_queue.doctorId to public doctor ids
    const pairs = [...idMap.entries()].map(([oldId, newId]) => ({
      oldId,
      newId,
    }));
    console.log(
      `Remapping appointment_queue.doctorId for ${pairs.length} doctors...`,
    );

    for (const batch of chunk(pairs, CHUNK_SIZE)) {
      const valuesSql: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const row of batch) {
        valuesSql.push(`($${p++}, $${p++})`);
        params.push(row.oldId, row.newId);
      }

      const sql = `
        UPDATE "${tenantSlug}"."appointment_queue" q
        SET "doctorId" = m.new_id
        FROM (VALUES ${valuesSql.join(', ')}) AS m(old_id, new_id)
        WHERE q."doctorId" = m.old_id
      `;
      await tenantDs.query(sql, params);
    }

    // Optional: touch queue repo to ensure connection initialized (no-op read)
    await tenantQueueRepo.count();
  }

  console.log('\n✅ Doctor migration/remap script completed.');
}

executeScript(run);
