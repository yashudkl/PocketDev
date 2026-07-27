import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class HeartbeatProjectDto {
  @IsString()
  @MaxLength(128)
  projectId!: string;

  @IsString()
  @MaxLength(1024)
  projectRoot!: string;
}

export class HeartbeatDto {
  // The public tunnel URL (Cloudflare Tunnel in the demo) where the desktop
  // agent's PTY-over-WebSocket server is reachable.
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https', 'ws', 'wss'] })
  tunnelUrl?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  projectRoot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HeartbeatProjectDto)
  projects?: HeartbeatProjectDto[];
}
