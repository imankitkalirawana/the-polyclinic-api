import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @Roles([Role.SUPERADMIN, Role.MODERATOR, Role.OPS])
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return await this.organizationService.create(createOrganizationDto);
  }

  @Get()
  @Roles([Role.SUPERADMIN, Role.MODERATOR, Role.OPS])
  async findAll() {
    return await this.organizationService.findAll();
  }

  @Get(':slug')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles([Role.SUPERADMIN, Role.MODERATOR, Role.OPS, Role.ADMIN])
  async findOne(@Param('slug') slug: string) {
    return await this.organizationService.findOne(slug);
  }

  @Patch(':slug')
  @Roles([Role.SUPERADMIN, Role.MODERATOR, Role.OPS, Role.ADMIN])
  async update(
    @Param('slug') slug: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return await this.organizationService.update(slug, updateOrganizationDto);
  }

  @Delete(':slug')
  @Roles([Role.SUPERADMIN, Role.MODERATOR, Role.OPS, Role.ADMIN])
  async remove(@Param('slug') slug: string) {
    return await this.organizationService.remove(slug);
  }
}
