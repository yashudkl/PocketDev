import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CommitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}

export class SetRemoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  url!: string;
}

export class DiffQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  path?: string;
}
