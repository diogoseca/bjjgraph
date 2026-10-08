#!/usr/bin/env bash
# The release and archive checksum come from ci-validate.yml. Local replay uses
# --check with ACTIONLINT=/path/to/actionlint instead of installing over the seat.
set -euo pipefail
: "${ACTIONLINT_VERSION:?The workflow must pin ACTIONLINT_VERSION}"

check_version() {
  local reported
  if ! reported=$("$1" -version); then
    echo "actionlint: cannot run $1; install the workflow's pinned version" >&2
    return 1
  fi
  reported=${reported%%$'\n'*}
  if [[ "$reported" != "$ACTIONLINT_VERSION" ]]; then
    echo "actionlint: expected $ACTIONLINT_VERSION, found $reported at $1" >&2
    return 1
  fi
  echo "actionlint: verified version $reported at $1"
}

if [[ $# == 1 && "$1" == --check ]]; then
  check_version "${ACTIONLINT:-actionlint}"
  exit 0
fi
if [[ $# != 0 ]]; then
  echo "usage: bash scripts/install_actionlint.sh [--check]" >&2
  exit 2
fi
: "${ACTIONLINT_SHA256:?The workflow must pin ACTIONLINT_SHA256}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required for installation}"
: "${GITHUB_PATH:?GITHUB_PATH is required for installation}"

actionlint_dir=$(mktemp -d "$RUNNER_TEMP/actionlint.XXXXXX")
archive="$actionlint_dir/actionlint.tar.gz"
curl --fail --silent --show-error --location --retry 3 --max-time 120 \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" \
  --output "$archive"
printf '%s  %s\n' "$ACTIONLINT_SHA256" "$archive" | sha256sum --check --strict
tar -xzf "$archive" -C "$actionlint_dir" actionlint
check_version "$actionlint_dir/actionlint"
printf '%s\n' "$actionlint_dir" >> "$GITHUB_PATH"
