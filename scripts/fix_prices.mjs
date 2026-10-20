import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Bun.env.NEXT_PUBLIC_SUPABASE_URL, Bun.env.SUPABASE_SECRET_KEY);

async function fixPrices() {
  await supabase.from('products').update({ price: 12 }).eq('id', 17);
  console.log('Updated price for Velcro Rod Fastening Straps to $12');
  
  await supabase.from('products').update({ price: 15 }).eq('id', 18);
  console.log('Updated price for Bite Alarm Bells Clamp to $15');
}

fixPrices();
