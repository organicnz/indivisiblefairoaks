import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Bun.env.NEXT_PUBLIC_SUPABASE_URL, Bun.env.SUPABASE_SECRET_KEY);

async function listOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_id, total_amount, stripe_session_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('Latest Order:', JSON.stringify(data, null, 2));
  
  if (data.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', data[0].id);
      
    if (!itemsError) {
      console.log('Order Items:', JSON.stringify(items, null, 2));
    }
  }
}

listOrders();
