import Stripe from 'stripe';

const stripeKey = Bun.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });

async function createSession() {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Product',
              metadata: { id: '6' } // Match a real Supabase product ID
            },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cart',
    });

    console.log('Session Created:', session.id);
    console.log('Session URL:', session.url);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createSession();
