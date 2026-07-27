import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BrowseDesktopDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  path?: string;
}
