import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ExplainTerminalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  command!: string;

  @IsString()
  @MaxLength(12_000)
  output!: string;

  @IsInt()
  @IsOptional()
  @Min(-1)
  @Max(255)
  exitCode?: number;
}
