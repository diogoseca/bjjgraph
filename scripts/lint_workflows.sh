#!/usr/bin/env bash
# Enumerate both extensions, including deployment workflows. Never let an empty
# glob turn into actionlint's implicit file selection or a false clean result.
set -euo pipefail
shopt -s nullglob
workflows=(.github/workflows/*.yml .github/workflows/*.yaml)
if (( ${#workflows[@]} == 0 )); then
  echo "actionlint: FAILED; 0 workflow files found" >&2
  exit 1
fi
echo "actionlint: inspecting ${#workflows[@]} workflow files"
"${ACTIONLINT:-actionlint}" -shellcheck= "${workflows[@]}"
echo "actionlint: checked ${#workflows[@]} workflow files; passed"
