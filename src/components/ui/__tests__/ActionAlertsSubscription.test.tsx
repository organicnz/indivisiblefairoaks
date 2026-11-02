// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionAlertsSubscription } from '@/components/ui/ActionAlertsSubscription';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockSubscribeActionAlerts } = vi.hoisted(() => ({
  mockSubscribeActionAlerts: vi.fn(),
}));

vi.mock('@/app/news/actions', () => ({
  subscribeActionAlerts: (formData: FormData) => mockSubscribeActionAlerts(formData),
}));

function changeInput(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ActionAlertsSubscription', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockSubscribeActionAlerts.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all seeded fallback copy and the mailto fallback link', async () => {
    await act(async () => {
      root.render(<ActionAlertsSubscription />);
    });

    expect(container.textContent).toContain('Direct To Your Inbox');
    expect(container.textContent).toContain('Subscribe to Action Alerts');
    expect(container.textContent).toContain(
      'Receive notifications for upcoming meetings, emergency rapid response rallies, choir rehearsal locations, and legislative call-to-action alerts.'
    );
    expect(container.textContent).toContain('Email to Subscribe');

    const mailto = container.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(mailto).not.toBeNull();
    expect(mailto?.getAttribute('href')).toBe(
      'mailto:subscribe@indivisiblefairoaks.org?subject=Subscribe%20to%20Indivisible%20Fair%20Oaks%20Newsletter'
    );
  });

  it('submits valid email and renders celebratory success state', async () => {
    mockSubscribeActionAlerts.mockResolvedValueOnce({
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
    });

    await act(async () => {
      root.render(<ActionAlertsSubscription />);
    });

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');
    const nameInput = container.querySelector<HTMLInputElement>('input[name="name"]');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    expect(emailInput).not.toBeNull();
    expect(submitBtn).not.toBeNull();

    await act(async () => {
      if (nameInput) changeInput(nameInput, 'Alex Rivera');
      if (emailInput) changeInput(emailInput, 'alex@example.org');
    });

    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockSubscribeActionAlerts).toHaveBeenCalledTimes(1);
    const submittedForm = mockSubscribeActionAlerts.mock.calls[0][0] as FormData;
    expect(submittedForm.get('email')).toBe('alex@example.org');
    expect(submittedForm.get('name')).toBe('Alex Rivera');

    // Success banner rendered
    expect(container.textContent).toContain("You're Subscribed to Action Alerts!");
    expect(container.textContent).toContain('Subscribe Another');
  });

  it('allows resetting after a successful submission', async () => {
    mockSubscribeActionAlerts.mockResolvedValueOnce({
      success: true,
      message: "You're on the list!",
    });

    await act(async () => {
      root.render(<ActionAlertsSubscription />);
    });

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');
    await act(async () => {
      if (emailInput) changeInput(emailInput, 'test@example.org');
    });

    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("You're Subscribed to Action Alerts!");

    const resetBtn = container.querySelector<HTMLButtonElement>('button[type="button"]');
    expect(resetBtn).not.toBeNull();

    await act(async () => {
      resetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Form inputs restored
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
  });

  it('displays error banner when subscription fails', async () => {
    mockSubscribeActionAlerts.mockResolvedValueOnce({
      error: 'Too many subscription attempts. Please try again in 50s.',
    });

    await act(async () => {
      root.render(<ActionAlertsSubscription />);
    });

    const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');
    await act(async () => {
      if (emailInput) changeInput(emailInput, 'spam@example.org');
    });

    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Too many subscription attempts');
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
  });
});
