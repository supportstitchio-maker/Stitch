
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'post-media';
const DRY_RUN = !process.argv.includes('--delete');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function idFromFileName(name) {
  const m = name.match(/^(\d+)-/);
  return m ? m[1] : null;
}

async function listAllFiles() {
  const files = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.storage.from(BUCKET).list('', {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || !data.length) break;
    files.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return files;
}

async function fetchAllIds(table) {
  const ids = new Set();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select('id').range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    data.forEach(row => ids.add(String(row.id)));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (nothing will be deleted)' : 'DELETE'}`);

  const [files, postIds, glimpseIds] = await Promise.all([
    listAllFiles(),
    fetchAllIds('posts'),
    fetchAllIds('glimpses'),
  ]);

  console.log(`Found ${files.length} files in "${BUCKET}", ${postIds.size} posts, ${glimpseIds.size} glimpses.`);

  const orphaned = files.filter(f => {
    const id = idFromFileName(f.name);
    if (!id) return false; 
    return !postIds.has(id) && !glimpseIds.has(id);
  });

  if (!orphaned.length) {
    console.log('No orphaned files found. Nothing to clean up.');
    return;
  }

  console.log(`\n${orphaned.length} orphaned file(s):`);
  orphaned.forEach(f => console.log('  -', f.name));

  if (DRY_RUN) {
    console.log('\nDry run only -- re-run with --delete to actually remove these.');
    return;
  }

  const paths = orphaned.map(f => f.name);
  const { error } = await sb.storage.from(BUCKET).remove(paths);
  if (error) {
    console.error('Delete failed:', error.message);
    process.exit(1);
  }
  console.log(`\nDeleted ${paths.length} orphaned file(s).`);
}

main().catch(err => {
  console.error('Cleanup script failed:', err);
  process.exit(1);
});
