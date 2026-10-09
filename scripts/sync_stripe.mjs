import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey || stripeKey.includes('placeholder') || stripeKey === 'sk_test_...') {
  console.error('\n❌ Missing Valid Stripe Secret Key!');
  console.error('Please add your STRIPE_SECRET_KEY (starting with sk_test_ or sk_live_) to indivisible-fairoaks/.env.local');
  console.error('You can find this in your Stripe Dashboard -> Developers -> API keys.\n');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia', typescript: true });

async function syncStripe() {
  console.log('🚀 Starting Stripe Synchronization...');

  const { data: products, error } = await supabase.from('products').select('*');

  if (error) {
    console.error('Failed to fetch products:', error.message);
    process.exit(1);
  }

  let syncedCount = 0;

  for (const product of products) {
    if (product.stripe_price_id) {
      console.log(`⏩ Skipping ${product.name} (Already synced)`);
      continue;
    }

    try {
      // 1. Create Product in Stripe
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.short_description || product.description?.substring(0, 500),
        images: product.image_url ? [product.image_url] : [],
        metadata: {
          supabase_id: product.id.toString(),
          wp_id: product.wp_id?.toString() || ''
        }
      });

      // 2. Create Price in Stripe
      const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(product.price * 100), // Stripe expects amounts in cents
        // Storefront currency lives in src/config/commerce.ts (CURRENCY). This
        // script cannot import TS, so the literal is repeated here — if that
        // module ever changes, this line must change with it.
        currency: 'usd',
      });

      // 3. Save Stripe IDs back to Supabase
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      console.log(`✅ Synced ${product.name} to Stripe.`);
      syncedCount++;
    } catch (err) {
      console.error(`❌ Failed to sync ${product.name}:`, err.message);
    }
  }

  console.log(`\n🎉 Stripe Sync Complete! Synced ${syncedCount} new products.`);
}

syncStripe().catch(console.error);