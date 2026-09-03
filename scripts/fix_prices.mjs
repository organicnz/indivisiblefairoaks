import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function fixPrices() {
  await supabase.from('products').update({ price: 12 }).eq('id', 17);
  console.log('Updated price for Velcro Rod Fastening Straps to $12');
  
  await supabase.from('products').update({ price: 15 }).eq('id', 18);
  console.log('Updated price for Bite Alarm Bells Clamp to $15');
}

fixPrices();
