import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tablesToVerify = [
  'products',
  'categories',
  'product_categories',
  'profiles',
  'orders',
  'order_items',
  'product_variations',
  'coupons',
  'content',
  'reviews',
  'gallery_photos',
  'events',
  'partners',
  'coalition_links',
  'newsletters',
  'search_rate_limit',
  'crm_contacts',
  'crm_activities',
  'crm_broadcasts',
  'crm_tasks',
  'crm_segments',
  'walle_knowledge_snapshots'
];

async function verifyMigration() {
  console.log('🔍 Verifying Supabase Data Migration...\n');
  console.log('-'.repeat(40));
  console.log(String('TABLE').padEnd(25) + '| ' + 'ROW COUNT');
  console.log('-'.repeat(40));

  let allSuccess = true;

  for (const table of tablesToVerify) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`❌ ${String(table).padEnd(23)} | Error: ${error.message}`);
      allSuccess = false;
    } else {
      console.log(`✅ ${String(table).padEnd(23)} | ${count}`);
    }
  }

  console.log('-'.repeat(40));

  if (allSuccess) {
    console.log('\n🎉 Verification Complete: All tables successfully queried.');
  } else {
    console.error('\n⚠️ Verification Complete: Some errors occurred during querying.');
    process.exitCode = 1;
  }
}

verifyMigration().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});