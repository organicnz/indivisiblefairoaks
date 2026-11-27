// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({
  revalidateTag,
  revalidatePath,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

const { revalidateCRMRoutes } = await import('@/lib/actions/crm/shared');

const paths = () => revalidatePath.mock.calls.map(([path]) => path);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('revalidateCRMRoutes', () => {
  it('expires crm-tags immediately and refreshes the three CRM views', () => {
    revalidateCRMRoutes();

    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith('crm-tags', { expire: 0 });
    expect(paths()).toEqual(['/admin/crm', '/admin/crm/tasks', '/admin/crm/broadcasts']);
  });

  it('also refreshes the contact 360 when a contact id is supplied', () => {
    revalidateCRMRoutes('contact-1');

    expect(revalidateTag).toHaveBeenCalledWith('crm-tags', { expire: 0 });
    expect(paths()).toEqual([
      '/admin/crm',
      '/admin/crm/tasks',
      '/admin/crm/broadcasts',
      '/admin/crm/contact-1',
    ]);
  });

  it('skips the contact 360 for a missing id', () => {
    revalidateCRMRoutes(null);

    expect(paths()).not.toContain('/admin/crm/null');
    expect(revalidatePath).toHaveBeenCalledTimes(3);
  });
});
