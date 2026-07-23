import { IsInt } from 'class-validator';

export class CompleteSessionDto {
  @IsInt()
  exitCode!: number;
}
