#!/usr/bin/env bash
# Computes the next CalVer tag: YYYY.DD.PATCH
# Finds the highest existing patch for the current year+day and increments it.
# Outputs nothing but the version string, suitable for: VERSION=$(bash scripts/next-version.sh)

set -euo pipefail

YEAR=$(date +%Y)
DAY=$(date +%-d)   # day of month, no leading zero (GNU date; works on Linux)
PREFIX="${YEAR}.${DAY}."

LAST=$(git tag --list "${PREFIX}*" | sort -t. -k3 -n | tail -1)

if [ -z "$LAST" ]; then
  echo "${YEAR}.${DAY}.0"
else
  PATCH="${LAST##*.}"
  echo "${YEAR}.${DAY}.$((PATCH + 1))"
fi
