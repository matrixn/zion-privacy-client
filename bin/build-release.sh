#!/usr/bin/env bash
set -euo pipefail

plugin_slug="zion-privacy-client"
main_file="zion-privacy-client.php"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_root="$project_root/.deploy/release"
stage_root="$release_root/$plugin_slug"
dist_root="$project_root/.dist"

cd "$project_root"

for command_name in php composer npm rsync zip unzip; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
done

version="$(php -r "if (!preg_match('/Version:\\s*([0-9.]+)/', file_get_contents('$main_file'), \$m)) { exit(1); } echo \$m[1];")"

composer validate --no-check-publish
npm ci
npm run build

rm -rf "$stage_root"
mkdir -p "$stage_root" "$dist_root"

rsync -a --delete \
  --exclude='.git/' \
  --exclude='.deploy/' \
  --exclude='.dist/' \
  --exclude='.github/' \
  --exclude='.idea/' \
  --exclude='.vscode/' \
  --exclude='.wp-env.json' \
  --exclude='.phpstan-cache/' \
  --exclude='.phpunit.cache/' \
  --exclude='.phpunit.result.cache' \
  --exclude='.gitignore' \
  --exclude='AGENTS.md' \
  --exclude='bin/' \
  --exclude='CHANGELOG.md' \
  --exclude='composer.lock' \
  --exclude='node_modules/' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='phpstan*' \
  --exclude='phpunit.xml*' \
  --exclude='tests/' \
  --exclude='deploy.ps1' \
  --exclude='*.log' \
  "$project_root/" "$stage_root/"

composer install \
  --working-dir="$stage_root" \
  --no-dev \
  --prefer-dist \
  --optimize-autoloader \
  --no-interaction

rm -f "$stage_root/composer.lock"

archive_path="$dist_root/$plugin_slug-$version.zip"
rm -f "$archive_path"
(cd "$release_root" && zip -qr "$archive_path" "$plugin_slug")

archive_entries="$(mktemp)"
trap 'rm -f "$archive_entries"' EXIT
unzip -Z1 "$archive_path" > "$archive_entries"

for required_path in \
  "$plugin_slug/$main_file" \
  "$plugin_slug/composer.json" \
  "$plugin_slug/build/index.tsx.js"; do
  if ! grep -Fxq "$required_path" "$archive_entries"; then
    echo "Required release file is missing: $required_path" >&2
    exit 1
  fi
done

echo "Release stage: $stage_root"
echo "Release archive: $archive_path"
