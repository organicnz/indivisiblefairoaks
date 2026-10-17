'use client';

import { Elements, ExpressCheckoutElement } from '@stripe/react-stripe-js';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import { CURRENCY } from '@/config/commerce';
import { buildCheckoutItems } from '@/lib/checkout-validation';
import { env } from '@/lib/env';
import { useCartStore } from '@/lib/store/cart';

const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export function StripeExpressCheckout() {
  const { items, totalPrice } = useCartStore();
  const [errorMessage, setErrorMessage] = useState('');
  const amount = totalPrice();

  if (!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return null; // Do not render if publishable key is missing
  }

  if (amount === 0) return null;

  const onConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!event) return;

    try {
      // Create a Checkout Session via Local API Route
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: buildCheckoutItems(items) }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to the Stripe Checkout URL to complete the payment
        window.location.href = data.url;
      } else {
        setErrorMessage(data.error || 'Something went wrong');
      }
    } catch {
      setErrorMessage('Checkout failed');
    }
  };

  return (
    <div className="mt-4">
      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-md text-sm border border-rose-100 dark:border-rose-900/50">
          {errorMessage}
        </div>
      )}
      <Elements
        stripe={stripePromise}
        options={{
          mode: 'payment',
          amount: Math.round(amount * 100) > 0 ? Math.round(amount * 100) : 100,
          currency: CURRENCY,
          locale: 'en',
        }}
      >
        <ExpressCheckoutElement
          onConfirm={onConfirm}
          options={{
            buttonType: {
              applePay: 'buy',
              googlePay: 'buy',
            },
          }}
        />
      </Elements>
    </div>
  );
}
