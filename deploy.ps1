param(
    [switch]$SkipTests,
    [switch]$DryRun,
    [string]$WslDistro = "",
    [string]$SynologyHost = "192.168.0.10",
    [int]$SynologyPort = 2022,
    [string]$SynologyUser = "wordpress-deploy",
    [string]$WordPressPluginsPath = "/volume1/www/macho.raduta.synology.me/wp-content/plugins",
    [string]$SshPrivateKey = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$slug = "zion-privacy-client"
$pluginFile = "zion-privacy-client.php"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($SshPrivateKey)) {
    $SshPrivateKey = Join-Path $env:USERPROFILE ".ssh\wordpress-plugin-deploy"
}

$remote = "$SynologyUser@$SynologyHost"
$remotePlugin = "$WordPressPluginsPath/$slug"
$remoteBackupRoot = "$WordPressPluginsPath/.deploy-backups/$slug"
$remoteArchive = "/tmp/$slug-$timestamp.tar.gz"
$remoteStage = "/tmp/$slug-stage-$timestamp"
$remoteOld = "$WordPressPluginsPath/.$slug-old-$timestamp"

function Bash-Quote {
    param([Parameter(Mandatory)][string]$Value)
    return "'" + ($Value -replace "'", "'\''") + "'"
}

function Run-Checked {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments
    )
    Write-Host "> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command ($LASTEXITCODE)"
    }
}

function Run-Wsl {
    param([Parameter(Mandatory)][string]$Script)
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    & wsl.exe -d $script:WslDistro -- bash -lc "echo '$encoded' | base64 -d | bash"
    if ($LASTEXITCODE -ne 0) {
        throw "WSL command failed ($LASTEXITCODE)"
    }
}

function Run-Remote {
    param([Parameter(Mandatory)][string]$Script)
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    & ssh.exe -i $SshPrivateKey -p $SynologyPort -o "IdentitiesOnly=yes" -o "PreferredAuthentications=publickey" $remote "echo '$encoded' | base64 -d | sh"
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed ($LASTEXITCODE)"
    }
}

foreach ($commandName in @("wsl.exe", "ssh.exe", "scp.exe")) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "Missing Windows command: $commandName"
    }
}

if (-not (Test-Path -LiteralPath $SshPrivateKey -PathType Leaf)) {
    throw "SSH key not found: $SshPrivateKey"
}

$projectWindows = $PSScriptRoot
$uncPattern = '^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.+)$'
if ($projectWindows -match $uncPattern) {
    if ([string]::IsNullOrWhiteSpace($WslDistro)) {
        $WslDistro = $Matches[1]
    }
    $projectLinux = "/" + ($Matches[2] -replace '\\', '/')
}
else {
    if ([string]::IsNullOrWhiteSpace($WslDistro)) {
        $WslDistro = "Ubuntu-22.04"
    }
    $projectLinux = (& wsl.exe -d $WslDistro -- wslpath -u "$projectWindows").Trim()
}

$buildLinux = "$projectLinux/.deploy"
$distLinux = "$projectLinux/.dist"
$releaseLinux = "$buildLinux/release/$slug"
$archiveLinux = "$distLinux/$slug-$timestamp.tar.gz"
$archiveWindows = Join-Path $projectWindows ".dist\$slug-$timestamp.tar.gz"

Write-Host "============================================" -ForegroundColor DarkGray
Write-Host "Package: $slug" -ForegroundColor Green
Write-Host "WSL: $WslDistro / $projectLinux"
Write-Host "Synology: $($SynologyHost):$SynologyPort"
Write-Host "Destination: $remotePlugin"
Write-Host "============================================" -ForegroundColor DarkGray

$projectQ = Bash-Quote $projectLinux
$buildQ = Bash-Quote $buildLinux
$distQ = Bash-Quote $distLinux
$releaseQ = Bash-Quote $releaseLinux
$archiveQ = Bash-Quote $archiveLinux
$slugQ = Bash-Quote $slug
$fileQ = Bash-Quote $pluginFile

$validateScript = @'
set -eu
cd __PROJECT__
test -f __FILE__
for command_name in php composer npm rsync tar zip unzip base64; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Missing WSL command: $command_name"; exit 1; }
done
echo "WSL project validation passed."
'@
Run-Wsl ($validateScript.Replace('__PROJECT__', $projectQ).Replace('__FILE__', $fileQ))

if (-not $SkipTests) {
    $testScript = @'
set -eu
cd __PROJECT__
find . -path './vendor' -prune -o -path './node_modules' -prune -o -path './.deploy' -prune -o -path './.dist' -prune -o -name '*.php' -print0 | xargs -0 -r -n1 php -l
composer validate --no-check-publish
echo "PHP and Composer checks passed."
'@
    Run-Wsl ($testScript.Replace('__PROJECT__', $projectQ))
}
else {
    Write-Host "Tests skipped with -SkipTests." -ForegroundColor DarkYellow
}

$buildScript = @'
set -eu
cd __PROJECT__
mkdir -p __BUILD__ __DIST__
rm -f __ARCHIVE__
bash __PROJECT__/bin/build-release.sh
test -f __RELEASE__/__FILE__
test -f __RELEASE__/composer.json
test -f __RELEASE__/readme.txt
test -f __RELEASE__/build/index.tsx.js
for forbidden in .git .github .idea .vscode node_modules tests bin .deploy .dist deploy.ps1 package.json package-lock.json composer.lock CHANGELOG.md; do
  test ! -e __RELEASE__/$forbidden || { echo "Forbidden release path: $forbidden"; exit 1; }
done
tar -C "$(dirname __RELEASE__)" -czf __ARCHIVE__ __SLUG__
test -f __ARCHIVE__
archive_listing=$(mktemp)
trap 'rm -f "$archive_listing"' EXIT
tar -tzf __ARCHIVE__ > "$archive_listing"
for required in __SLUG_RAW__/__FILE_RAW__ __SLUG_RAW__/composer.json __SLUG_RAW__/readme.txt __SLUG_RAW__/build/index.tsx.js; do
  grep -Fqx "$required" "$archive_listing" || { echo "Missing archive path: $required"; exit 1; }
done
ls -lh __ARCHIVE__
'@
$buildScript = $buildScript.Replace('__PROJECT__', $projectQ).Replace('__BUILD__', $buildQ).Replace('__DIST__', $distQ).Replace('__ARCHIVE__', $archiveQ).Replace('__RELEASE__', $releaseQ).Replace('__SLUG__', $slugQ).Replace('__FILE__', $fileQ).Replace('__SLUG_RAW__', $slug).Replace('__FILE_RAW__', $pluginFile)
Run-Wsl $buildScript

if (-not (Test-Path -LiteralPath $archiveWindows -PathType Leaf)) {
    throw "Windows cannot access generated archive: $archiveWindows"
}

if ($DryRun) {
    Write-Host "DRY-RUN completed: $archiveWindows" -ForegroundColor Yellow
    exit 0
}

Run-Checked "ssh.exe" @("-i", $SshPrivateKey, "-p", $SynologyPort.ToString(), "-o", "IdentitiesOnly=yes", "-o", "PreferredAuthentications=publickey", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", $remote, "echo SSH_OK")

$validateRemote = @'
set -eu
test -d __PLUGINS__
test -w __PLUGINS__
command -v tar >/dev/null 2>&1
command -v base64 >/dev/null 2>&1
echo "Synology destination validation passed."
'@
Run-Remote ($validateRemote.Replace('__PLUGINS__', (Bash-Quote $WordPressPluginsPath)))

Run-Checked "scp.exe" @("-O", "-i", $SshPrivateKey, "-P", $SynologyPort.ToString(), "-o", "IdentitiesOnly=yes", $archiveWindows, "$($remote):$remoteArchive")

$deployScript = @'
set -eu
plugin=__PLUGIN__
plugin_file=__FILE__
plugin_path=__PLUGIN_PATH__
archive_path=__ARCHIVE__
stage_path=__STAGE__
package_path="$stage_path/$plugin"
old_path=__OLD__
backup_root=__BACKUP_ROOT__
backup_path=__BACKUP_PATH__
moved=0

cleanup() {
  rm -f "$archive_path"
  rm -rf "$stage_path"
}

rollback() {
  rm -rf "$plugin_path"
  test ! -d "$old_path" || mv "$old_path" "$plugin_path"
}

on_exit() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$moved" -eq 1 ]; then
    echo "Deployment failed; restoring previous version."
    rollback || true
  fi
  cleanup
  exit "$status"
}
trap on_exit EXIT HUP INT TERM

test -f "$archive_path"
rm -rf "$stage_path"
mkdir -p "$stage_path"
tar -xzf "$archive_path" -C "$stage_path"
test -f "$package_path/$plugin_file"

mkdir -p "$backup_root"
if [ -d "$plugin_path" ]; then
  rm -rf "$backup_path"
  cp -a "$plugin_path" "$backup_path"
  rm -rf "$old_path"
  mv "$plugin_path" "$old_path"
fi

moved=1
mv "$package_path" "$plugin_path"
find "$plugin_path" -type d -exec chmod 755 {} \;
find "$plugin_path" -type f -exec chmod 644 {} \;
test -f "$plugin_path/$plugin_file"
rm -rf "$old_path"
moved=0

count=0
for backup in $(ls -1dt "$backup_root"/* 2>/dev/null || true); do
  count=$((count + 1))
  if [ "$count" -gt 5 ]; then rm -rf "$backup"; fi
done

echo "Deployment completed: $plugin_path"
'@
$deployScript = $deployScript.Replace('__PLUGIN__', (Bash-Quote $slug)).Replace('__FILE__', (Bash-Quote $pluginFile)).Replace('__PLUGIN_PATH__', (Bash-Quote $remotePlugin)).Replace('__ARCHIVE__', (Bash-Quote $remoteArchive)).Replace('__STAGE__', (Bash-Quote $remoteStage)).Replace('__OLD__', (Bash-Quote $remoteOld)).Replace('__BACKUP_ROOT__', (Bash-Quote $remoteBackupRoot)).Replace('__BACKUP_PATH__', (Bash-Quote "$remoteBackupRoot/$timestamp"))
Run-Remote $deployScript

Write-Host "DEPLOYMENT COMPLETED: $remotePlugin" -ForegroundColor Green
