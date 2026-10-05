# LovePDuo — open Windows firewall for LAN WS (run as Admin once)
$port = 8787
$name = "LovePDuo Realtime $port"
$existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
if (-not $existing) {
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
  Write-Host "Created firewall rule: $name"
} else {
  Write-Host "Firewall rule already exists: $name"
}
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | ForEach-Object {
  Write-Host ("Use in Profile: ws://{0}:{1}" -f $_.IPAddress, $port)
}
