# No administrator rights required. Does not install packages or change system settings.
[CmdletBinding()]
param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'reports'))
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ram = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
$nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
$gpu = @()
if ($nvidia) {
    $raw = & $nvidia.Source --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits 2>$null
    if ($LASTEXITCODE -eq 0) {
        $gpu = @($raw | ConvertFrom-Csv -Header Name, VramMiB, Driver | ForEach-Object {
            @{ name = $_.Name.Trim(); vram_mib = [int]$_.VramMiB.Trim(); driver = $_.Driver.Trim() }
        })
    }
}
$disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
    @{ drive = $_.DeviceID; free_gib = [math]::Round($_.FreeSpace / 1GB, 1) }
})
$report = @{
    schema_version = 1
    captured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    os = $os.Caption; os_version = $os.Version
    cpu = $cpu.Name; ram_gib = [math]::Round($ram / 1GB, 1)
    gpu = $gpu; disks = $disks
    commands = @{ git = [bool](Get-Command git -ErrorAction SilentlyContinue); python = [bool](Get-Command python -ErrorAction SilentlyContinue); wsl = [bool](Get-Command wsl -ErrorAction SilentlyContinue) }
}
$path = Join-Path $OutputDirectory 'hardware.json'
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $path
Write-Host "Saved hardware report: $path"
Write-Host 'Next: open PC-TASK.md in Codex on this PC. No inference has run yet.'
