// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveContactNotificationRecipient } from '../../../supabase/functions/_shared/contact-recipient';

describe('contact notification recipients', () => {
  const defaultRecipient = 'contact@indivisiblefairoaks.org';

  it('routes marked backend probes to the dedicated test recipient', () => {
    expect(
      resolveContactNotificationRecipient({
        name: 'Backend Verification Probe',
        message: 'Backend migration verification probe, marked PROBE for cleanup.',
        defaultRecipient,
        verificationRecipient: 'tamerlanium@gmail.com',
      })
    ).toBe('tamerlanium@gmail.com');
  });

  it('does not send a marked probe to the chapter inbox when no test recipient exists', () => {
    expect(
      resolveContactNotificationRecipient({
        name: 'Backend Verification Probe',
        message: 'Marked PROBE for cleanup.',
        defaultRecipient,
      })
    ).toBeNull();
  });

  it('keeps ordinary contact submissions on the chapter inbox', () => {
    expect(
      resolveContactNotificationRecipient({
        name: 'Resident',
        message: 'Please send information about the next meeting.',
        defaultRecipient,
        verificationRecipient: 'tamerlanium@gmail.com',
      })
    ).toBe(defaultRecipient);
  });
});
