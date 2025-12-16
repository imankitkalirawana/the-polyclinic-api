import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCatDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
