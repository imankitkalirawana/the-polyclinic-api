import './types';
import { executeScript } from './script-runner.util';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersService as PublicUsersService } from '../modules/public/users/users.service';
import { TenantsService } from '../modules/public/tenants/tenants.service';
import { TenantAuthInitService } from '../modules/tenancy/tenant-auth-init.service';
import { getTenantConnectionConfig } from '../tenant-orm.config';
import { TenantUser } from '../modules/client/auth/entities/tenant-user.entity';
import { PublicUser } from '../modules/public/auth/entities/public-user.entity';
import { Role, SystemRole } from '../common/enums/role.enum';
import { Status } from '../common/enums/status.enum';
import * as bcrypt from 'bcryptjs';

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
  const publicUsersService = app.get(PublicUsersService);
  const tenantsService = app.get(TenantsService);
  const tenantAuthInitService = app.get(TenantAuthInitService);
  const dataSource = app.get(DataSource);

  // Step 1: Create superadmin user in public schema
  console.log('📝 Step 1: Creating superadmin user in public schema...');
  try {
    const existingSuperadmin = await dataSource
      .getRepository(PublicUser)
      .findOne({ where: { email: SUPERADMIN_EMAIL } });

    if (existingSuperadmin) {
      console.log(
        `   ⚠️  Superadmin user with email ${SUPERADMIN_EMAIL} already exists. Skipping...`,
      );
    } else {
      await publicUsersService.create({
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
        name: SUPERADMIN_NAME,
        role: SystemRole.SUPERADMIN,
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

  // Step 4: Create admin user in tenant schema
  console.log('\n📝 Step 4: Creating admin user in tenant schema...');
  let tenantDataSource: DataSource | null = null;
  try {
    // Create a DataSource connection to the tenant schema
    const baseConfig = getTenantConnectionConfig(TENANT_SLUG);
    // Ensure TenantUser entity is included - create new config object
    const tenantConfig = {
      ...baseConfig,
      entities: [
        TenantUser,
        ...(Array.isArray(baseConfig.entities) ? baseConfig.entities : []),
      ],
    };
    tenantDataSource = new DataSource(tenantConfig);
    await tenantDataSource.initialize();

    // Check if admin user already exists
    const existingAdmin = await tenantDataSource
      .getRepository(TenantUser)
      .findOne({ where: { email: ADMIN_EMAIL } });

    if (existingAdmin) {
      console.log(
        `   ⚠️  Admin user with email ${ADMIN_EMAIL} already exists in tenant "${TENANT_SLUG}". Skipping...`,
      );
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

      // Create admin user
      const adminUser = tenantDataSource.getRepository(TenantUser).create({
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: ADMIN_NAME,
        role: Role.ADMIN,
        status: Status.ACTIVE,
      });

      await tenantDataSource.getRepository(TenantUser).save(adminUser);
      console.log(
        `   ✅ Admin user created successfully in tenant "${TENANT_SLUG}"! Email: ${ADMIN_EMAIL}`,
      );
    }
  } catch (error) {
    console.error(
      '   ❌ Error creating admin user:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    if (tenantDataSource && tenantDataSource.isInitialized) {
      await tenantDataSource.destroy();
    }
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
