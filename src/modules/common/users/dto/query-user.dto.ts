import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryUserDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
