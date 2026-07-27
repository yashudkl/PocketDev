import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinkProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  desktopPath!: string;
}
