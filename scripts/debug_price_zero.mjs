import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Bun.env.NEXT_PUBLIC_SUPABASE_URL, Bun.env.SUPABASE_SECRET_KEY);

async function checkPrices() {
  const { data, error } = await supabase.from('products').select('id, name, price, stripe_price_id').eq('price', 0);
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('Products with price 0:', JSON.stringify(data, null, 2));
}

checkPrices();
