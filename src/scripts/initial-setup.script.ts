import './types';
import { executeScript } from './script-runner.util';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersService } from '../modules/common/users/users.service';
import { TenantsService } from '../modules/common/tenants/tenants.service';
import { TenantAuthInitService } from '../modules/tenancy/tenant-auth-init.service';
import { User } from '../modules/common/users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

const SUPERADMIN_EMAIL = 'superadmin@polyclinic.com';
const SUPERADMIN_NAME = 'Super Admin';
const SUPERADMIN_PASSWORD = 'Ankit@123';
const TENANT_NAME = 'test';
const TENANT_SLUG = 'test';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_NAME = 'Admin';
const ADMIN_PASSWORD = 'Ankit@123';

async function run(app: INestApplicationContext) {
  console.log('🚀 Starting initial setup...\n');

  // Get required services
  const usersService = app.get(UsersService);
  const tenantsService = app.get(TenantsService);
  const tenantAuthInitService = app.get(TenantAuthInitService);
  const dataSource = app.get(DataSource);

  // Step 1: Create superadmin user in public schema
  console.log('📝 Step 1: Creating superadmin user in public schema...');
  try {
    const existingSuperadmin = await dataSource
      .getRepository(User)
      .findOne({ where: { email: SUPERADMIN_EMAIL } });

    if (existingSuperadmin) {
      console.log(
        `   ⚠️  Superadmin user with email ${SUPERADMIN_EMAIL} already exists. Skipping...`,
      );
    } else {
      await usersService.create({
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
        name: SUPERADMIN_NAME,
        role: Role.SUPERADMIN,
      });
      console.log(
        `   ✅ Superadmin user created successfully! Email: ${SUPERADMIN_EMAIL}`,
      );
    }
  } catch (error) {
    console.error(
      '   ❌ Error creating superadmin user:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  // Step 2: Create tenant/organization "test"
  console.log('\n📝 Step 2: Creating tenant/organization "test"...');
  let tenant;
  try {
    const existingTenant = await tenantsService
      .findOne(TENANT_SLUG)
      .catch(() => null);
    if (existingTenant) {
      console.log(
        `   ⚠️  Tenant with slug "${TENANT_SLUG}" already exists. Using existing tenant...`,
      );
      tenant = existingTenant;
    } else {
      tenant = await tenantsService.create({
        name: TENANT_NAME,
        slug: TENANT_SLUG,
      });
      console.log(
        `   ✅ Tenant created successfully! Name: ${tenant.name}, Slug: ${tenant.slug}`,
      );
    }
  } catch (error) {
    console.error(
      '   ❌ Error creating tenant:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  // Step 3: Ensure tenant schema is initialized
  console.log('\n📝 Step 3: Ensuring tenant schema is initialized...');
  try {
    await tenantAuthInitService.ensureTenantAuthTables(TENANT_SLUG);
    console.log(
      `   ✅ Tenant schema "${TENANT_SLUG}" initialized successfully!`,
    );
  } catch (error) {
    console.error(
      `   ❌ Error initializing tenant schema:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  // Step 4: Create admin user in public schema and add to tenant
  console.log('\n📝 Step 4: Creating admin user and adding to tenant...');
  try {
    const existingAdmin = await dataSource
      .getRepository(User)
      .findOne({ where: { email: ADMIN_EMAIL } });

    let adminUser;
    if (existingAdmin) {
      console.log(
        `   ⚠️  Admin user with email ${ADMIN_EMAIL} already exists. Using existing user...`,
      );
      adminUser = existingAdmin;
    } else {
      adminUser = await usersService.create({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
        role: Role.ADMIN,
      });
      console.log(
        `   ✅ Admin user created successfully! Email: ${ADMIN_EMAIL}`,
      );
    }

    // Add admin user to tenant
    await usersService.addUserToTenantBySlug(adminUser.id, TENANT_SLUG);
    console.log(`   ✅ Admin user added to tenant "${TENANT_SLUG}"`);
  } catch (error) {
    console.error(
      '   ❌ Error creating admin user:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  console.log('\n✨ Initial setup completed successfully!\n');
  console.log('📋 Summary:');
  console.log(`   • Superadmin: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
  console.log(`   • Tenant: ${tenant.name} (slug: ${tenant.slug})`);
  console.log(
    `   • Admin User: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (in tenant "${TENANT_SLUG}")`,
  );
  console.log('\n');
}

// Execute the script using the utility
executeScript(run);
