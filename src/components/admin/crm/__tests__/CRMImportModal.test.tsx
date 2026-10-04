import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMImportModal } from '@/components/admin/crm/CRMImportModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock('@/lib/actions/crm', () => ({
  importCRMContacts: vi.fn().mockResolvedValue({ success: true, imported: 0, skipped: 0 }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEADER = 'email,first_name,last_name,phone,city,zip_code,district,status,tags,notes';

const csvOf = (rows: number) =>
  [HEADER, ...Array.from({ length: rows }, (_, i) => `person${i}@example.com,Person${i}`)].join(
    '\n'
  );

/**
 * A bulk import is the one directory mutation with no undo, so a large paste
 * gets a confirm step that names the row count. Small imports stay one click.
 */
describe('CRMImportModal large-import confirm', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = () => {
    act(() => {
      root.render(<CRMImportModal isOpen onClose={() => {}} />);
    });
  };

  const text = () => document.body.textContent ?? '';

  const setNativeValue = (el: HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const paste = (rows: number) => {
    act(() => {
      setNativeValue(document.querySelector('#csv-paste') as HTMLTextAreaElement, csvOf(rows));
    });
  };

  it('confirms a large import and names the row count', () => {
    render();
    paste(150);

    const importButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Import Contacts')
    );
    expect(importButton).toBeTruthy();
    act(() => {
      importButton?.click();
    });

    expect(text()).toContain('This will add up to 150 contacts');
  });

  it('imports small batches in one click', () => {
    render();
    paste(10);

    expect(text()).not.toContain('This will add up to');
    expect(text()).toContain('Import Contacts');
  });
});
