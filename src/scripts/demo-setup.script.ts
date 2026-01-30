import './types';
import { executeScript } from './script-runner.util';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from 'src/common/enums/role.enum';
import { Company, CompanyType } from 'src/modules/auth/entities/company.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import {
  assertRoleAllowedForCompanyType,
  defaultRoleForCompanyType,
} from 'src/modules/auth/utils/company-role.util';

type DemoUser = {
  email: string;
  name: string;
  role: Role;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertSafeSchemaName(raw: string): string {
  const schema = raw.trim();
  if (!schema) throw new Error('schema is required');
  if (schema.length > 63) throw new Error('schema too long');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error('invalid schema format');
  }
  const lowered = schema.toLowerCase();
  if (
    lowered === 'public' ||
    lowered === 'information_schema' ||
    lowered === 'pg_catalog' ||
    lowered === 'pg_toast'
  ) {
    throw new Error('schema is reserved');
  }
  return schema;
}

async function run(app: INestApplicationContext) {
  const dataSource = app.get(DataSource);

  const companyRepo = dataSource.getRepository(Company);
  const userRepo = dataSource.getRepository(User);

  const companyCode = (getArg('--company-code') ?? 'DEMO').trim().toUpperCase();
  const schemaName = assertSafeSchemaName(getArg('--schema') ?? 'demo');
  const internalCompanyCode = (getArg('--internal-company-code') ?? 'TPC')
    .trim()
    .toUpperCase();
  const internalSchemaName = assertSafeSchemaName(
    getArg('--internal-schema') ?? 'app',
  );
  const password =
    getArg('--password') ?? process.env.DEMO_PASSWORD ?? 'Password@123';

  // 1) Create/reuse INTERNAL company (THE_POLYCLINIC) + group (allow-list schema)
  let internalCompany = await companyRepo.findOne({
    where: { company_code: internalCompanyCode },
  });
  if (!internalCompany) {
    internalCompany = companyRepo.create({
      name: 'The Polyclinic (Internal)',
      company_code: internalCompanyCode,
      company_type: CompanyType.THE_POLYCLINIC,
      schema: internalSchemaName,
      currency: 'INR',
      time_zone: 'Asia/Kolkata',
    });
    internalCompany = await companyRepo.save(internalCompany);
  } else if (internalCompany.deletedAt) {
    await companyRepo.softRemove(internalCompany);
  }

  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${internalSchemaName}"`);

  // Groups are deprecated; membership is stored on `login_users.companies[]`.

  // 2) Create/reuse CLIENT company + group (allow-list schema)
  let company = await companyRepo.findOne({
    where: { company_code: companyCode },
  });
  if (!company) {
    company = companyRepo.create({
      name: 'Demo Company',
      company_code: companyCode,
      company_type: CompanyType.CLIENT,
      schema: schemaName,
      currency: 'INR',
      time_zone: 'Asia/Kolkata',
    });
    company = await companyRepo.save(company);
  } else if (company.deletedAt) {
    await companyRepo.softRemove(company);
  }

  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // Groups are deprecated; membership is stored on `login_users.companies[]`.

  // 3) Create users according to company_type role rules
  const internalUsers: DemoUser[] = [
    {
      email: 'superadmin@internal.local',
      name: 'Internal Super Admin',
      role: Role.SUPER_ADMIN,
    },
    {
      email: 'moderator@internal.local',
      name: 'Internal Moderator',
      role: Role.MODERATOR,
    },
    { email: 'ops@internal.local', name: 'Internal Ops', role: Role.OPS },
  ];

  const clientUsers: DemoUser[] = [
    { email: 'admin@demo.com', name: 'Demo Admin', role: Role.ADMIN },
    { email: 'doctor@demo.com', name: 'Demo Doctor', role: Role.DOCTOR },
    { email: 'nurse@demo.com', name: 'Demo Nurse', role: Role.NURSE },
    {
      email: 'receptionist@demo.com',
      name: 'Demo Receptionist',
      role: Role.RECEPTIONIST,
    },
    { email: 'patient@demo.com', name: 'Demo Patient', role: Role.PATIENT },
  ];

  const created: Array<{ email: string; id: string; role: Role }> = [];

  const createUserAndAssign = async (
    u: DemoUser,
    companyType: CompanyType,
    timeZone: string,
    schema: string,
  ) => {
    const email = normalizeEmail(u.email);
    assertRoleAllowedForCompanyType(u.role, companyType);

    let user = await userRepo.findOne({
      where: { email },
    });

    if (!user) {
      const password_digest = await bcrypt.hash(password, 10);
      user = userRepo.create({
        email,
        name: u.name,
        phone: null,
        password_digest,
        role: u.role ?? defaultRoleForCompanyType(companyType),
        company_type: companyType,
        email_verified: true,
        deleted: false,
        time_zone: timeZone ?? 'UTC',
        permissions: {},
        companies: [schema.toLowerCase()],
      });
      user = await userRepo.save(user);
    } else {
      const existingCompanies = Array.isArray(user.companies)
        ? user.companies
        : [];
      const normalized = existingCompanies
        .map((c) => String(c).trim().toLowerCase())
        .filter(Boolean);
      if (!normalized.includes(schema.toLowerCase())) {
        user.companies = [...new Set([...normalized, schema.toLowerCase()])];
        user = await userRepo.save(user);
      }
    }

    created.push({ email: user.email, id: user.id, role: user.role });
  };

  for (const u of internalUsers) {
    await createUserAndAssign(
      u,
      CompanyType.THE_POLYCLINIC,
      internalCompany.time_zone ?? 'UTC',
      internalSchemaName,
    );
  }
  for (const u of clientUsers) {
    await createUserAndAssign(
      u,
      CompanyType.CLIENT,
      company.time_zone ?? 'UTC',
      schemaName,
    );
  }

  // Output summary
  // (Avoid printing password if you don’t want secrets in logs; keep for demo convenience.)
  console.log('\n✅ Demo setup complete\n');
  console.log('Internal Company:', {
    id: internalCompany.id,
    code: internalCompany.company_code,
    type: internalCompany.company_type,
  });
  console.log('Internal schema:', internalSchemaName);
  console.log('Company:', {
    id: company.id,
    code: company.company_code,
    type: company.company_type,
  });
  console.log('Client schema:', schemaName);
  console.log('Users:');
  created.forEach((u) => console.log(`- ${u.role}: ${u.email} (id=${u.id})`));
  console.log('\nPassword for all demo users:', password);
  console.log('\nNext steps:');
  console.log('- Login (global): POST /api/v1/auth/login with email/password');
  console.log(
    '- Issue tenant token: POST /api/v1/auth/tenant-token with group_id and global token',
  );
}

executeScript(run);
