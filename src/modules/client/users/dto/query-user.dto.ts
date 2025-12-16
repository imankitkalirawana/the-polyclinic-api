import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';
import { Status } from 'src/common/enums/status.enum';

export class QueryUserDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
