import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.tenantsService.findOne(slug);
  }

  @Patch(':slug')
  update(
    @Param('slug') slug: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(slug, updateTenantDto);
  }

  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.tenantsService.remove(slug);
  }
}
