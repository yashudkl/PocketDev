import { IsString, MaxLength, MinLength } from 'class-validator';

export class WriteFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  path!: string;

  // UTF-8 text content (the code editor saves text; binaries go via CLI sync).
  @IsString()
  @MaxLength(2 * 1024 * 1024)
  content!: string;
}
