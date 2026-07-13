<#
.SYNOPSIS
  Turn the desktop agent's quick tunnel into a STABLE named Cloudflare tunnel that
  runs as a Windows service. Automates everything after the two account-specific
  steps that only you can do (they need YOUR Cloudflare account + a domain you own).

.PREREQUISITES (run these yourself first — a browser opens for login):
  cloudflared tunnel login                 # authenticate + pick your zone
  cloudflared tunnel create <TunnelName>   # creates the tunnel + <UUID>.json creds

.EXAMPLE
  # Run in an ELEVATED PowerShell (service install needs admin):
  ./scripts/setup-named-tunnel.ps1 -Name pocketdev-desktop -Hostname desktop.yourdomain.com
#>
param(
  [Parameter(Mandatory = $true)][string]$Name,       # tunnel name you created
  [Parameter(Mandatory = $true)][string]$Hostname,   # e.g. desktop.yourdomain.com
  [int]$LocalPort = 4000                              # desktop agent port
)

$ErrorActionPreference = 'Stop'
$cfDir = Join-Path $env:USERPROFILE '.cloudflared'

$cred = Get-ChildItem $cfDir -Filter '*.json' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $cred) {
  Write-Error "No <UUID>.json in $cfDir. Run 'cloudflared tunnel login' then 'cloudflared tunnel create $Name' first."
  exit 1
}
$uuid = [IO.Path]::GetFileNameWithoutExtension($cred.Name)
Write-Host "Using tunnel $Name ($uuid)"

# 1. Route the public hostname at the tunnel (creates the proxied CNAME).
cloudflared tunnel route dns $Name $Hostname

# 2. Install as a Windows service. When run as a service, cloudflared reads its
#    config from the SYSTEM profile, so write config + creds there.
$sysCf = 'C:\Windows\System32\config\systemprofile\.cloudflared'
New-Item -ItemType Directory -Force -Path $sysCf | Out-Null
Copy-Item $cred.FullName (Join-Path $sysCf $cred.Name) -Force

$config = @"
tunnel: $uuid
credentials-file: $sysCf\$($cred.Name)
ingress:
  - hostname: $Hostname
    service: http://localhost:$LocalPort
  - service: http_status:404
"@
$configPath = Join-Path $sysCf 'config.yml'
$config | Out-File -FilePath $configPath -Encoding utf8
Write-Host "Wrote $configPath"

cloudflared tunnel ingress validate --config $configPath
cloudflared service install
Start-Service cloudflared -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Done. Desktop is reachable at wss://$Hostname (stable, auto-starts on boot)."
Write-Host "Set the desktop agent's tunnel URL:  `$env:POCKETDEV_TUNNEL_URL='wss://$Hostname'"
