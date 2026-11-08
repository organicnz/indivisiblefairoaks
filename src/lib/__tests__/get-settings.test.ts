// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

async function loadGetSettings() {
  vi.resetModules();
  const module = await import('@/lib/supabase-server');
  return module.getSettings;
}

describe('getSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without constructing the SSR client when there is no auth cookie', async () => {
    mocks.cookies.mockResolvedValue({
      getAll: () => [{ name: 'theme', value: 'dark' }],
    });
    const getSettings = await loadGetSettings();

    await expect(getSettings()).resolves.toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('reads profile settings when a chunked auth cookie is present', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { theme: 'dark' } },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.createServerClient.mockResolvedValue({ auth: { getUser }, from });
    mocks.cookies.mockResolvedValue({
      getAll: () => [{ name: 'sb-project-auth-token.0', value: 'chunk' }],
    });
    const getSettings = await loadGetSettings();

    await expect(getSettings()).resolves.toEqual({ theme: 'dark' });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
