const fs = require('fs');
const sql = fs.readFileSync('supabase/migrations/20260826164213_seed_uhrzeit_conversation_pools.sql', 'utf8');
// Each INSERT value row uses $json$ ... $json$::jsonb. Ensure pairs balance.
const tokens = (sql.match(/\$json\$/g) || []).length;
console.log('dollar-quote tokens (expect even):', tokens);
console.log('ON CONFLICT clauses (3 data + 1 comment = 4):', (sql.match(/ON CONFLICT/g) || []).length);
console.log('INSERT statements:', (sql.match(/INSERT INTO public.content_items/g) || []).length);
console.log('ends with semicolon:', sql.trimEnd().endsWith(';'));
// Show one complete sample INSERT row for visual confirmation.
const m = sql.match(/\('zeit-[^;]*/);
console.log('sample row:\n', m ? m[0].slice(0, 260) : 'none');