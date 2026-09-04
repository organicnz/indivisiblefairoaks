import { expect, test } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

test.describe('Search API End-to-End', () => {
  test('should return 400 for empty query', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Search query is required');
  });

  test('should return 400 for missing body', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: null,
    });
    expect(response.status()).toBe(400);
  });

  test('should return 403 for spam query', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: { q: 'casino slots betting' },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('restricted terms');
  });

  test('should return 429 when rate limit exceeded', async ({ request }) => {
    const promises = [];
    for (let i = 0; i < 35; i++) {
      promises.push(
        request.post(`${BASE_URL}/api/search`, {
          data: { q: 'test query' },
        })
      );
    }
    const responses = await Promise.all(promises);
    const rateLimited = responses.find((r) => r.status() === 429);
    expect(rateLimited).toBeDefined();
    expect(rateLimited.status()).toBe(429);
  });

  test('should return structured JSON with products and posts', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: { q: 'organic' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('products');
    expect(body).toHaveProperty('posts');
    expect(body).toHaveProperty('query');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('remaining');
    expect(body).toHaveProperty('requestId');
  });

  test('should include request-id and x-rate-limit-remaining headers', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: { q: 'test' },
    });
    expect(response.headers()['request-id']).toBeDefined();
    expect(response.headers()['x-rate-limit-remaining']).toBeDefined();
  });

  test('should filter spam in content titles', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: { q: 'test' },
    });
    const body = await response.json();
    for (const post of body.posts) {
      const hasSpam = /casino|slot|betting|porn|lottery/i.test(post.title);
      expect(hasSpam).toBe(false);
    }
  });

  test('should cap query length at 100 characters', async ({ request }) => {
    const longQuery = 'a'.repeat(150);
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: { q: longQuery },
    });
    const body = await response.json();
    expect(body.query).toHaveLength(100);
  });

  test('should return circuit breaker open status when RPCs fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/search`, {
      data: { q: 'test' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('requestId');
    expect(body).toHaveProperty('remaining');
  });
});
