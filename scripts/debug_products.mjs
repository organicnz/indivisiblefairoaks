import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Bun.env.NEXT_PUBLIC_SUPABASE_URL, Bun.env.SUPABASE_SECRET_KEY);

async function listProducts() {
  const { data, error } = await supabase.from('products').select('id, name').limit(5);
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('Products:', JSON.stringify(data, null, 2));
}

listProducts();
