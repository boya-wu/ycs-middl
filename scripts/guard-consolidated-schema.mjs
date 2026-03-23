import { execSync } from 'node:child_process';

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const base = getArgValue('--base');
const head = getArgValue('--head') || 'HEAD';

if (!base) {
  console.error('[guard-consolidated-schema] Missing required argument: --base <git-sha>');
  process.exit(2);
}

let changedFiles = [];
try {
  const out = execSync(`git diff --name-only ${base}..${head}`, { encoding: 'utf8' }).trim();
  changedFiles = out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];
} catch (err) {
  console.error('[guard-consolidated-schema] Failed to compute git diff:', err?.message || err);
  process.exit(2);
}

const consolidatedChanged = changedFiles.includes('supabase/consolidated_schema.sql');
const migrationsChanged = changedFiles.some((f) => f.startsWith('supabase/migrations/'));

if (consolidatedChanged && !migrationsChanged) {
  console.error(
    [
      '[guard-consolidated-schema] Blocked: `supabase/consolidated_schema.sql` was changed without any `supabase/migrations/*` changes.',
      'Reason: `consolidated_schema.sql` must be treated as an auto-generated snapshot.',
    ].join('\n')
  );
  process.exit(1);
}

console.log('[guard-consolidated-schema] OK');

