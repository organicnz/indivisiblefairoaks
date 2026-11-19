import { vi } from 'vitest';

export type OverlayMediaSelection = {
  url: string;
  alt?: string;
  name: string;
  width?: number | null;
  height?: number | null;
};

export const overlayMocks = {
  content: {
    saveContent: vi.fn(),
    setContentStatus: vi.fn(),
    getContentForEdit: vi.fn(),
    getContentBySlugForEdit: vi.fn(),
    getContentRevisions: vi.fn(),
    restoreContentRevision: vi.fn(),
  },
  crm: {
    getCRMEdgeFunctionHealth: vi.fn(),
    uploadCRMMedia: vi.fn(),
    getCRMContacts: vi.fn().mockResolvedValue({ contacts: [], total: 0 }),
  },
  visual: {
    getVisualPageContext: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  editContext: {
    isAdmin: true,
    loading: false,
    target: null as { label: string; editUrl: string } | null,
  },
  router: {
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  },
  pathname: {
    value: '/about',
  },
  visualMode: {
    enabled: true,
  },
  mediaLibrary: {
    onSelectMedia: null as ((media: OverlayMediaSelection) => void | Promise<void>) | null,
  },
};
