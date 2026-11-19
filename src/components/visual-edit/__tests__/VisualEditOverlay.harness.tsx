// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect } from 'vitest';
import { VisualEditOverlay } from '@/components/visual-edit/VisualEditOverlay';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import { overlayMocks } from './VisualEditOverlay.mocks';

export { VisualEditOverlay };

export const {
  getContentBySlugForEdit,
  getContentForEdit,
  getContentRevisions,
  restoreContentRevision,
  saveContent,
  setContentStatus,
} = overlayMocks.content;
export const { getCRMEdgeFunctionHealth, uploadCRMMedia } = overlayMocks.crm;
export const { getVisualPageContext } = overlayMocks.visual;
export const { toast } = overlayMocks;
export const { editContext, mediaLibrary, pathname, router, visualMode } = overlayMocks;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The page as the browser renders it: the sanitized body, in the DOM. */
export function renderPage(sanitizedHtml: string) {
  const root = document.createElement('div');
  root.setAttribute('data-visual-edit-root', '');
  root.innerHTML = sanitizedHtml;
  const main = document.createElement('main');
  main.appendChild(root);
  document.body.appendChild(main);
  return root;
}

export let container: HTMLDivElement;
export let root: Root;

beforeEach(() => {
  saveContent.mockReset();
  setContentStatus.mockReset();
  getContentForEdit.mockReset();
  getContentBySlugForEdit.mockReset();
  getContentRevisions.mockReset();
  restoreContentRevision.mockReset();
  getCRMEdgeFunctionHealth.mockReset();
  getVisualPageContext.mockReset();
  uploadCRMMedia.mockReset();
  mediaLibrary.onSelectMedia = null;
  toast.success.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
  getCRMEdgeFunctionHealth.mockResolvedValue({
    database: true,
    storage: true,
    edgeFunction: true,
  });
  getVisualPageContext.mockResolvedValue({
    content: null,
    revisions: [],
    revisionsTruncated: false,
    media: { items: [], folders: ['crm', 'content', 'gallery'] },
    backend: { database: true, storage: true, edgeFunction: true },
    crmStats: null,
    segments: [],
    segmentsTruncated: false,
    catalog: { galleryPhotos: 0, events: 0 },
  });
  saveContent.mockResolvedValue({
    success: true,
    data: { id: 7, updatedAt: '2026-10-10T00:00:00Z' },
  });
  editContext.isAdmin = true;
  editContext.target = null;
  visualMode.enabled = true;
  pathname.value = '/about';
  router.replace.mockReset();
  window.history.replaceState({}, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  window.localStorage.clear();
});

export async function mount() {
  await act(async () => {
    root.render(<VisualEditOverlay />);
  });
}

/** Recreate the React root on the same container after an explicit unmount. */
export function recreateRoot() {
  root = createRoot(container);
}

/**
 * A page whose sanitized body has fewer elements than its block model.
 *
 * This is the whole bug in one fixture: three blocks, two rendered elements,
 * and the third block is the one an organiser would actually want to edit.
 */
export const body = '<p>Intro copy.</p><form><input></form><h2 class="cw cw--h2">Mission</h2>';
export const rendered = '<p>Intro copy.</p><h2 class="cw cw--h2">Mission</h2>';

export async function withPage(page?: { body?: string; rendered?: string }) {
  renderPage(page?.rendered ?? rendered);
  getContentBySlugForEdit.mockResolvedValue({
    id: 7,
    title: 'About Us',
    slug: 'about',
    excerpt: null,
    type: 'page',
    status: 'publish',
    body: page?.body ?? body,
    featured_image: null,
    metadata: {},
    updated_at: '2026-10-09T00:00:00Z',
  });
  await mount();
}

export const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  );

export async function openImageMediaLibrary() {
  const toolbar = container.querySelector<HTMLElement>('[aria-label="Image asset controls"]');
  expect(toolbar).not.toBeNull();
  const replace = Array.from(toolbar?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
    (button) => button.textContent?.trim() === 'Replace'
  );
  expect(replace).toBeDefined();
  await act(async () => {
    replace?.click();
  });
  expect(mediaLibrary.onSelectMedia).not.toBeNull();
}

/** The page as the browser holds it: the overlay's frames sit over these. */
export const pageChildren = () => {
  const page = document.querySelector<HTMLElement>('[data-visual-edit-root]');
  expect(page).not.toBeNull();
  return page as HTMLElement;
};

export async function openComposerOn(frameIndex: number) {
  const composers = container.querySelectorAll<HTMLButtonElement>(
    'button[aria-label="Visual Composer Inspector"]'
  );
  expect(composers[frameIndex]).toBeDefined();
  await act(async () => {
    composers[frameIndex]?.click();
  });
}

export const openComposerOnFirstBlock = () => openComposerOn(0);

/**
 * Make one draft change the compiler actually emits. The radius alone is not
 * emitted while the border width is zero — a rounded edge with no edge to
 * round is not a visual change — so the test uses the border preset that sets
 * both, the same way an operator would.
 */
export async function changeCornerRadius() {
  await act(async () => {
    byText('Box Model')?.click();
  });
  const preset = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Apply Modern Card border preset"]'
  );
  expect(preset).not.toBeNull();
  await act(async () => {
    preset?.click();
  });
}

/**
 * Leave the document dirty without opening the composer. The delete persists,
 * so undoing it restores the original body against a saved baseline that now
 * describes the deleted one.
 */
export async function dirtyThePage() {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 0 } })
    );
  });
  const undo = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Undo the last change"]'
  );
  expect(undo).not.toBeNull();
  await act(async () => {
    undo?.click();
  });
  expect(document.body.textContent).toContain('unsaved changes');
}

/** Fire the browser's hard-leave event and report whether it was intercepted. */
export const attemptHardLeave = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

/** The composer's visual copy surface, not a raw-HTML field or the Code tab. */
export const composerCopy = (): HTMLElement => {
  const editor = document.querySelector<HTMLElement>(
    'aside[role="dialog"] [contenteditable="true"]'
  );
  if (!editor) throw new Error('expected the composer copy editor');
  return editor;
};

/** Type into the composer's copy field, the way the Content tab does. */
export async function changeComposerCopy(text: string) {
  const editor = composerCopy();
  await act(async () => {
    editor.innerHTML = text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export const asRect = (top: number, bottom: number): DOMRect =>
  ({
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;
