#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-}"
if [[ -z "$TYPE" ]]; then
  echo "Usage: bash scripts/version-bump.sh patch|minor|major" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "package.json" ]]; then
  echo "package.json not found" >&2
  exit 1
fi
if [[ ! -f "CHANGELOG.md" ]]; then
  echo "CHANGELOG.md not found" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Please commit or stash first." >&2
  exit 1
fi

NEW_VERSION="$(npm version "$TYPE" --no-git-tag-version)"
NEW_VERSION="${NEW_VERSION#v}"

DATE="$(date +%F)"

NEW_VERSION="$NEW_VERSION" DATE="$DATE" node <<'NODE'
const fs = require('fs');

const newVersion = process.env.NEW_VERSION;
const date = process.env.DATE;
const file = 'CHANGELOG.md';

if (!newVersion || !date) {
  console.error('Missing NEW_VERSION or DATE env var');
  process.exit(1);
}

const md = fs.readFileSync(file, 'utf8');
const marker = '## [Unreleased]';
const idx = md.indexOf(marker);
if (idx === -1) {
  console.error('CHANGELOG.md missing "## [Unreleased]"');
  process.exit(1);
}

const insert = `${marker}\n\n## [${newVersion}] - ${date}\n`;
// 只處理第一個 Unreleased（避免重複插入）
const updated = md.replace(marker, insert);
fs.writeFileSync(file, updated, 'utf8');
NODE

git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): v${NEW_VERSION}"
git tag "v${NEW_VERSION}"

cat <<EOF
Release ready:
- version: v${NEW_VERSION}
- tag: v${NEW_VERSION}

Next:
- git push
- git push --tags
EOF

