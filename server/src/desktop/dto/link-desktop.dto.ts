import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinkDesktopDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  path!: string;
}
