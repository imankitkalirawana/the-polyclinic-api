import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat } from './entities/cat.entity';
import { CONNECTION } from '../../tenancy/tenancy.symbols';

@Injectable()
export class CatsService {
  private get catRepository(): Repository<Cat> {
    const connection = this.tenantConnection;
    if (!connection || !connection.isInitialized) {
      throw new BadRequestException('Tenant connection not available');
    }
    return connection.getRepository(Cat);
  }

  constructor(
    @Inject(CONNECTION)
    private readonly tenantConnection: DataSource | null,
  ) {}

  async create(createCatDto: CreateCatDto): Promise<Cat> {
    const cat = this.catRepository.create(createCatDto);
    return this.catRepository.save(cat);
  }

  async findAll(): Promise<Cat[]> {
    return this.catRepository.find();
  }

  async findOne(id: string): Promise<Cat> {
    const cat = await this.catRepository.findOne({ where: { id } });
    if (!cat) {
      throw new NotFoundException(`Cat with id ${id} not found`);
    }
    return cat;
  }

  async update(id: string, updateCatDto: UpdateCatDto): Promise<Cat> {
    await this.catRepository.update(id, updateCatDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.catRepository.delete(id);
  }
}
