import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/stripe';

const mockEvent = {
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_live_a1YvslFKQK3RlHt4FzW16dYrImVxjdHtzwa0MzWVCc8DTFpGu7vzviP9rW',
      amount_total: 1000, 
      currency: 'nzd',
      customer_details: {
        email: 'test@example.com',
        address: {
          line1: '123 Test St',
          city: 'Auckland',
          country: 'NZ'
        }
      },
      collected_information: {
        customer_details: {
          email: 'test@example.com',
          address: {
            line1: '123 Test St',
            city: 'Auckland',
            country: 'NZ'
          }
        },
        shipping_details: {
          name: 'Test User',
          address: {
            line1: '456 Shipping Rd',
            city: 'Wellington',
            country: 'NZ'
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
