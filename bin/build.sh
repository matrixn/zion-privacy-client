#!/usr/bin/env bash
set -euo pipefail

# Compatibility entry point for local and CI callers that use bin/build.sh.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-release.sh" "$@"
