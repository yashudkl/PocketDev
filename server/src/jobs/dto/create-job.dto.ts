import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(1)
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  command!: string;
}
