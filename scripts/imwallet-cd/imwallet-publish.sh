#!/usr/bin/env bash
set -euo pipefail

# Quick helper: commit + push IMWallet scoped paths.
# Usage:
#   scripts/imwallet-cd/imwallet-publish.sh "feat: adjust send form"
#   scripts/imwallet-cd/imwallet-publish.sh "fix: backend health check" backend .github/workflows

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 \"<commit-message>\" [path ...]" >&2
  exit 1
fi

COMMIT_MESSAGE="$1"
shift || true

if [[ $# -eq 0 ]]; then
  set -- imwallet-app imwallet-console backend database .github/workflows scripts/imwallet-cd IMWALLET_AUTODEPLOY_SETUP.md
fi

git rev-parse --is-inside-work-tree >/dev/null

echo "[INFO] Staging paths: $*"
git add -- "$@"

if git diff --cached --quiet; then
  echo "[INFO] No staged changes for selected paths."
  exit 0
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ -n "${IMWALLET_GIT_REMOTE:-}" ]]; then
  TARGET_REMOTE="${IMWALLET_GIT_REMOTE}"
elif git remote get-url imwallet >/dev/null 2>&1; then
  TARGET_REMOTE="imwallet"
else
  TARGET_REMOTE="origin"
fi

echo "[INFO] Commit: ${COMMIT_MESSAGE}"
git commit -m "${COMMIT_MESSAGE}"

echo "[INFO] Push: ${TARGET_REMOTE}/${CURRENT_BRANCH}"
git push "${TARGET_REMOTE}" "${CURRENT_BRANCH}"

echo "[INFO] Publish completed."
