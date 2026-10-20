// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the env module so we can control validated values per-test
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'https://test.example.com',
    RESEND_API_KEY: '',
    RESEND_FROM_EMAIL: 'contact@indivisiblefairoaks.org',
    ADMIN_ORDER_EMAIL: 'contact@indivisiblefairoaks.org',
  },
}));

import {
  escapeHtml,
  safeSubject,
  sendContactNotification,
  sendEmail,
  stripControls,
} from '@/lib/email';
import { env } from '@/lib/env';
import { installFetchMock } from './fetch-mock';

describe('Resend email utilities', () => {
  describe('sanitization helpers', () => {
    it('escapes HTML characters to prevent XSS / formatting injection', () => {
      expect(escapeHtml('<script>alert("test") & \'fun\'</script>')).toBe(
        "&lt;script&gt;alert(&quot;test&quot;) &amp; 'fun'&lt;/script&gt;"
      );
    });

    it('strips control characters that could inject SMTP headers', () => {
      expect(stripControls('Subject line\r\nBcc: victim@example.com\x00')).toBe(
        'Subject lineBcc: victim@example.com'
      );
    });

    it('truncates and cleans subject lines', () => {
      const longSubject = 'A'.repeat(300);
      const cleaned = safeSubject(`Test: \r\n${longSubject}`);
      expect(cleaned.length).toBe(200);
      expect(cleaned).not.toContain('\r');
      expect(cleaned).not.toContain('\n');
    });
  });

  describe('sendEmail()', () => {
    const originalFetch = global.fetch;
    const mockEnv = env as unknown as Record<string, string | undefined>;

    beforeEach(() => {
      mockEnv.RESEND_API_KEY = 're_test_dummy_key_for_testing';
      mockEnv.RESEND_FROM_EMAIL = 'contact@indivisiblefairoaks.org';
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('returns error when API key is missing', async () => {
      mockEnv.RESEND_API_KEY = '';
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('missing-resend-api-key');
      }
    });

    it('validates recipients and rejects empty or malformed targets', async () => {
      const resultEmpty = await sendEmail({
        to: [],
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });
      expect(resultEmpty.ok).toBe(false);

      const resultMalformed = await sendEmail({
        to: 'not-an-email',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });
      expect(resultMalformed.ok).toBe(false);
    });

    it('successfully calls Resend API and returns email ID on success', async () => {
      let requestBody: Record<string, unknown> = {};
      installFetchMock(
        vi.fn().mockImplementation(async (_url, options) => {
          requestBody = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({ id: 'email_12345' }),
          } as Response;
        })
      );

      const result = await sendEmail({
        to: 'member@example.com',
        subject: 'Welcome to Indivisible Fair Oaks',
        html: '<strong>Hello!</strong>',
        text: 'Hello!',
        replyTo: 'organizer@indivisiblefairoaks.org',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.id).toBe('email_12345');
      }

      expect(requestBody.from).toBe('contact@indivisiblefairoaks.org');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer re_test_dummy_key_for_testing',
          }),
        })
      );
    });

    it('passes custom RFC headers (e.g. List-Unsubscribe) through to Resend', async () => {
      let requestBody: Record<string, unknown> = {};
      installFetchMock(
        vi.fn().mockImplementation(async (_url, options) => {
          requestBody = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({ id: 'email_headers_1' }),
          } as Response;
        })
      );

      const result = await sendEmail({
        to: 'member@example.com',
        subject: 'Broadcast',
        html: '<p>Hi</p>',
        text: 'Hi',
        headers: {
          'List-Unsubscribe': '<mailto:contact@indivisiblefairoaks.org?subject=Unsubscribe>',
        },
      });

      expect(result.ok).toBe(true);
      expect(requestBody.headers).toEqual({
        'List-Unsubscribe': '<mailto:contact@indivisiblefairoaks.org?subject=Unsubscribe>',
      });
    });

    it('safely handles Resend API error responses without throwing', async () => {
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => JSON.stringify({ message: 'Domain not verified' }),
        } as Response)
      );

      const result = await sendEmail({
        to: 'member@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
        expect(result.error).toContain('Domain not verified');
      }
    });

    it('safely catches network transport errors', async () => {
      installFetchMock(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      const result = await sendEmail({
        to: 'member@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('transport:TypeError');
      }
    });
  });

  describe('sendContactNotification()', () => {
    const originalFetch = global.fetch;
    const mockEnv = env as unknown as Record<string, string | undefined>;

    beforeEach(() => {
      mockEnv.RESEND_API_KEY = 're_test_dummy_key_for_testing';
      mockEnv.ADMIN_ORDER_EMAIL = 'contact@indivisiblefairoaks.org';
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('formats and sends contact submission notification', async () => {
      let requestBody: Record<string, unknown> = {};
      installFetchMock(
        vi.fn().mockImplementation(async (_url, options) => {
          requestBody = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({ id: 'contact_msg_999' }),
          } as Response;
        })
      );

      const result = await sendContactNotification({
        id: 99,
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Interested in postcard writing party!',
      });

      expect(result.ok).toBe(true);
      expect(requestBody.to).toEqual(['contact@indivisiblefairoaks.org']);
      expect(requestBody.subject).toBe('[Contact Form #99] Message from Jane Doe');
      expect(requestBody.reply_to).toBe('jane@example.com');
      expect(String(requestBody.html)).toContain('Jane Doe');
      expect(String(requestBody.html)).toContain('Interested in postcard writing party!');
    });
  });
});
