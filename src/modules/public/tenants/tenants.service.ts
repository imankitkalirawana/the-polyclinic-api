import {
  Injectable,
  Inject,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { getTenantSchemaName } from '../../tenancy/tenancy.utils';
import { getTenantConnectionConfig } from '../../../tenant-orm.config';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @Inject(DataSource)
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Create tenants table if it doesn't exist
    await this.ensureTenantsTableExists();
  }

  private async ensureTenantsTableExists() {
    try {
      // Check if table exists
      const result = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tenants'
        );
      `);

      if (!result[0].exists) {
        this.logger.log('Creating tenants table...');
        await this.dataSource.query(`
          CREATE TABLE public.tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR NOT NULL,
            slug VARCHAR NOT NULL UNIQUE,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        this.logger.log('Tenants table created successfully');
      }
    } catch (error) {
      this.logger.error('Error creating tenants table:', error);
      throw error;
    }
  }

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Create tenant record in public schema
    const tenant = this.tenantRepository.create(createTenantDto);
    const savedTenant = await this.tenantRepository.save(tenant);

    // Create schema for the tenant
    const schemaName = getTenantSchemaName(savedTenant.slug);
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Create connection to tenant schema
    const tenantConfig = getTenantConnectionConfig(savedTenant.slug);
    const tenantConnection = new DataSource(tenantConfig);
    await tenantConnection.initialize();

    try {
      // Run migrations or create tables
      // For now, we'll use synchronize for simplicity (not recommended for production)
      // In production, you should use migrations
      await tenantConnection.synchronize();
    } finally {
      // Close the connection after setup
      if (tenantConnection.isInitialized) {
        await tenantConnection.destroy();
      }
    }

    return savedTenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async findOne(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }
    return tenant;
  }

  async update(
    slug: string,
    updateTenantDto: UpdateTenantDto,
  ): Promise<Tenant> {
    const tenant = await this.findOne(slug);
    await this.tenantRepository.update(tenant.id, updateTenantDto);
    return this.findOne(slug);
  }

  async remove(slug: string): Promise<void> {
    // Resolve the tenant first to get its id
    const tenant = await this.findOne(slug);

    // Drop the tenant schema using slug
    const schemaName = getTenantSchemaName(tenant.slug);
    await this.dataSource.query(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );

    // Delete tenant record using id
    await this.tenantRepository.delete(tenant.id);
  }
}
