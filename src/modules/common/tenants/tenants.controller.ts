import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { StandardParam, StandardParams } from 'nest-standard-response';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @UseGuards(BearerAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  async create(
    @Body() createTenantDto: CreateTenantDto,
    @StandardParam() params: StandardParams,
  ) {
    const tenant = await this.tenantsService.create(createTenantDto);
    params.setMessage('Tenant created successfully');
    return tenant;
  }

  @Get()
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    return this.tenantsService.findOne(slug);
  }

  @Patch(':slug')
  @UseGuards(BearerAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async update(
    @Param('slug') slug: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @StandardParam() params: StandardParams,
  ) {
    const tenant = await this.tenantsService.update(slug, updateTenantDto);
    params.setMessage('Tenant updated successfully');
    return tenant;
  }

  @Delete(':slug')
  @UseGuards(BearerAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  async remove(
    @Param('slug') slug: string,
    @StandardParam() params: StandardParams,
  ) {
    await this.tenantsService.remove(slug);
    params.setMessage('Tenant deleted successfully');
    return null;
  }
}
