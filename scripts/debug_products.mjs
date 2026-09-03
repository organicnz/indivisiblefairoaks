import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function listProducts() {
  const { data, error } = await supabase.from('products').select('id, name').limit(5);
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('Products:', JSON.stringify(data, null, 2));
}

listProducts();
