import { InjectRepository } from '@nestjs/typeorm';
import { MasterKeyEntity } from './entities/masterkey.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { generatePassword } from '@/auth/users/users.utils';

export class MasterKeyService {
  constructor(
    @InjectRepository(MasterKeyEntity)
    private readonly masterKeyRepository: Repository<MasterKeyEntity>,
  ) {}

  private readonly globalMasterKeyKey = 'global_master_key';
  private readonly globalMasterKeyLength = 32;
  private readonly globalMasterKeyDescription =
    'Global master key for the application to authenticate requests';

  private async generateRandomString(password: string) {
    return await bcrypt.hash(password, 10);
  }

  async getGlobalMasterKey() {
    const masterKey = await this.masterKeyRepository.findOne({
      where: { key: this.globalMasterKeyKey },
      select: {
        value_digest: true,
        key: true,
        description: true,
      },
    });
    if (!masterKey) {
      throw new NotFoundException('Master key not found');
    }
    return masterKey;
  }

  private async createGlobalMasterKey(password: string) {
    this.masterKeyRepository.create({
      key: this.globalMasterKeyKey,
      value_digest: await this.generateRandomString(password),
      description: this.globalMasterKeyDescription,
    });

    return {
      key: this.globalMasterKeyKey,
      password,
    };
  }

  async generateGlobalMasterKey() {
    const password = generatePassword();

    const result = await this.masterKeyRepository.update(
      { key: this.globalMasterKeyKey },
      { value_digest: await this.generateRandomString(password) },
    );

    if (result.affected === 0) {
      return await this.createGlobalMasterKey(password);
    }
    return {
      key: this.globalMasterKeyKey,
      password,
    };
  }
}
