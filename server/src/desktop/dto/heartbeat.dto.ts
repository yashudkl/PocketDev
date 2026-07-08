import { IsOptional, IsUrl } from 'class-validator';

export class HeartbeatDto {
  // The public tunnel URL (Cloudflare Tunnel in the demo) where the desktop
  // agent's PTY-over-WebSocket server is reachable.
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https', 'ws', 'wss'] })
  tunnelUrl?: string;
}
