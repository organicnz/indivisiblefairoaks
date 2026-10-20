#!/usr/bin/env bun
/**
 * Local Stripe webhook smoke test.
 *
 * Posts a mock `checkout.session.completed` event at a running dev server.
 *
 * `fetch` is Bun's own — there is no `node-fetch` import, because there is no
 * Node runtime to provide one. `node-fetch` was never a declared dependency
 * of this project either; it resolved only because it is a transitive
 * dependency of the Vercel CLI, so this script would have failed on a clean
 * `bun install` for a package the lockfile does not promise.
 */
const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/stripe';

const mockEvent = {
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_live_a1YvslFKQK3RlHt4FzW16dYrImVxjdHtzwa0MzWVCc8DTFpGu7vzviP9rW',
      amount_total: 1000, 
      currency: 'usd',
      customer_details: {
        email: 'test@example.com',
        address: {
          line1: '123 Test St',
          city: 'Carmichael',
          country: 'US'
        }
      },
      collected_information: {
        customer_details: {
          email: 'test@example.com',
          address: {
            line1: '123 Test St',
            city: 'Carmichael',
            country: 'US'
          }
        },
        shipping_details: {
          name: 'Test User',
          address: {
            line1: '456 Shipping Rd',
            city: 'Sacramento',
            country: 'US'
          }
        }
      },
      client_reference_id: 'test_user_id',
      metadata: {
        userId: 'test_user_id'
      }
    }
  }
};

async function testWebhook() {
  console.log('🧪 Sending mock webhook event to:', WEBHOOK_URL);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass': 'true'
      },
      body: JSON.stringify(mockEvent)
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook test passed!');
    } else {
      console.log('\n❌ Webhook test failed!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWebhook();
