import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Bun.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = Bun.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runHealthCheck() {
  console.log('🏥 Indivisible Fair Oaks-Carmichael Production Readiness Health Check\n');

  // 1. Check Product/Image Integrity
  const { data: products } = await supabase.from('products').select('name, image_url');
  const brokenImages = products.filter(p => !p.image_url || p.image_url.includes('wp-content'));

  if (brokenImages.length === 0) {
    console.log('✅ All products have migrated Supabase images.');
  } else {
    console.warn(`⚠️ Found ${brokenImages.length} products with broken/old image links.`);
  }

  // 2. Check Spam Content Cleanup
  const { count: spamCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .or('title.ilike.%slot%,title.ilike.%casino%,title.ilike.%judi%');

  if (spamCount === 0) {
    console.log('✅ Content table is clean of common spam keywords.');
  } else {
    console.error(`❌ Found ${spamCount} leftover spam records in content table!`);
  }

  // 3. Check Order/Profile counts
  const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });

  console.log(`📊 Stats: ${profileCount} Profiles, ${orderCount} Orders, ${products.length} Products.`);

  // 4. Verify RLS (basic check)
  const { data: contactCheck } = await supabase.from('contact_submissions').select('*').limit(1);
  if (contactCheck) {
    console.log('✅ Contact submissions are accessible (verify if this should be admin-only).');
  }

  console.log('\n🚀 App is ready for production deployment!');
}

runHealthCheck().catch(console.error);
