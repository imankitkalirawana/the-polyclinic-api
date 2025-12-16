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
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @Inject(DataSource)
    private readonly dataSource: DataSource,
    private readonly tenantAuthInitService: TenantAuthInitService,
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

    // Initialize auth tables for the tenant (production-ready SQL DDL)
    await this.tenantAuthInitService.initializeTenantAuth(savedTenant.slug);

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
    const { slug: _, ...safeUpdate } = updateTenantDto;

    await this.tenantRepository.update(tenant.id, safeUpdate);
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

  /**
   * Initialize auth tables for an existing tenant
   * Useful for fixing tenants that were created before auth was implemented
   */
  async initializeAuth(slug: string): Promise<void> {
    await this.findOne(slug); // Verify tenant exists
    await this.tenantAuthInitService.initializeTenantAuth(slug);
  }

  /**
   * Initialize auth tables for all existing tenants
   * Useful for migration or fixing existing tenants
   */
  async initializeAllAuth(): Promise<void> {
    await this.tenantAuthInitService.initializeAllTenantsAuth();
  }
}
