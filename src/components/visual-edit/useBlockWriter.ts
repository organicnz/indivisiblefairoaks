'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ActionResult, ContentInput } from '@/lib/actions/content';
import type { Block } from '@/lib/blocks';
import { describeOversizedBody } from '@/lib/content';
import {
  COPY_REGION_VERSION_ATTR,
  copyRegionLocationForSlug,
  copyRegionSlug,
} from '@/lib/copy-regions';

/**
 * Shared write path for the visual editor's direct-edit surfaces.
 *
 * Every inline edit, image replace, and section mutation reaches the backend
 * through one of two shapes:
 *
 *  1. A **copy region** — the whole `data-copy-region` subtree is posted as
 *     `content.body` under the region's own slug (never the page's slug, so a
 *     region's first save can never land on the page document).
 *  2. A **block** — one entry in the block array is mutated, committed to the
 *     undo history, and persisted with `handlePersistBlocks`.
 *
 * `commitInlineEdit`, `handleSaveImageAlt`, `handleDirectImageUpload` and the
 * media-library selector each used to re-implement both shapes, with subtly
 * different toast messages and rollback behaviour. This hook owns the shared
 * mechanics (the `savingBackend` guard, the region-slug rule, the commit+persist
 * pair); each call site keeps its own messages and rollback through callbacks.
 */

export interface CopyRegionSaveResult {
  id: number;
  updatedAt: string | null;
  publishedAt: string | null;
}

export interface UseBlockWriterArgs {
  commitBlocks: (next: Block[], coalesceKey?: string | null) => void;
  handlePersistBlocks: (
    newBlocks: Block[],
    successMessage?: string
  ) => Promise<{ success: boolean }>;
  saveContentWithEdgeApi: (
    payload: ContentInput
  ) => Promise<ActionResult<CopyRegionSaveResult>>;
  setSavingBackend: (v: boolean) => void;
  /**
   * Called after a copy-region write succeeds. The caller decides whether the
   * written region is the active document; a region edit must never move the
   * host page's saved baseline.
   */
  onCopyRegionSaved: (
    copyRegionId: string,
    body: string,
    saved: CopyRegionSaveResult
  ) => void;
  /**
   * The loaded version of the region's existing row, when the write is the
   * active region. The row is still resolved by slug — that is the branch that
   * preserves the columns the body editor does not own — while the timestamp
   * makes the second save conditional instead of last-write-wins.
   */
  getCopyRegionVersion: (
    copyRegionId: string
  ) => { updatedAt: string | null } | null;
  router: { refresh: () => void };
  /** The document generation that owns this write. */
  getDocumentEpoch: () => number;
  /** Why the saved document cannot accept a write right now, if it cannot. */
  documentReadRefusal: () => string | null;
}

export interface WriteToCopyRegionArgs {
  copyRegionId: string;
  successMessage?: string;
  errorMessage?: string;
  /** Rollback applied to the live DOM when the save fails. */
  onRollback?: () => void;
}

export interface WriteToBlockArgs {
  blockIndex: number;
  blocks: Block[];
  /**
   * Receives the target block and returns its replacement, or `undefined` when
   * the block is not one this write applies to (the write is skipped).
   */
  mutate: (target: Block) => Block | undefined;
  successMessage?: string;
  errorMessage?: string;
  coalesceKey?: string | null;
}

export function useBlockWriter(args: UseBlockWriterArgs) {
  const {
    commitBlocks,
    handlePersistBlocks,
    saveContentWithEdgeApi,
    setSavingBackend,
    onCopyRegionSaved,
    getCopyRegionVersion,
    router,
    getDocumentEpoch,
    documentReadRefusal,
  } = args;

  /**
   * Persist a whole copy region as its own CMS row.
   *
   * The body is read from the live DOM *here*, not passed in: every caller
   * needs the post-edit `innerHTML` of the same `[data-copy-region]` element,
   * and a caller that queried it itself would be one more place the selector
   * could drift from the slug rule.
   */
  const writeToCopyRegion = useCallback(
    async ({
      copyRegionId,
      successMessage,
      errorMessage,
      onRollback,
    }: WriteToCopyRegionArgs): Promise<boolean> => {
      const refusal = documentReadRefusal();
      if (refusal) {
        toast.error(refusal);
        onRollback?.();
        return false;
      }
      const regionContainer = document.querySelector<HTMLElement>(
        `[data-copy-region="${copyRegionId}"]`
      );
      if (!regionContainer) {
        toast.error(errorMessage ?? 'Failed to save copy region');
        onRollback?.();
        return false;
      }
      const body = regionContainer.innerHTML;
      // Client-side pre-check: catch an oversized body before it reaches the
      // server, so the operator gets an actionable message instead of an opaque
      // Zod rejection.
      const oversized = describeOversizedBody(body, 'copy region');
      if (oversized) {
        toast.error(oversized);
        onRollback?.();
        return false;
      }
      const writeEpoch = getDocumentEpoch();
      const slug = copyRegionSlug(copyRegionId);
      const title =
        copyRegionLocationForSlug(slug)?.region.label ?? copyRegionId;
      /*
       * The active region's loaded row is the best version source. On a
       * whole-page edit there is no loaded region row, so fall back to the
       * version the page rendered onto this element. Without it a page-mode
       * inline edit could overwrite a colleague's region save with no signal.
       */
      const domVersion = regionContainer.hasAttribute(COPY_REGION_VERSION_ATTR)
        ? { updatedAt: regionContainer.getAttribute(COPY_REGION_VERSION_ATTR) || null }
        : null;
      const version = getCopyRegionVersion(copyRegionId) ?? domVersion;
      setSavingBackend(true);
      try {
        const res = await saveContentWithEdgeApi({
          slug,
          title,
          body,
          status: 'publish',
          type: 'page',
          // A known region row is written with the version it was read at, so a
          // colleague's save cannot be silently overwritten. The row itself is
          // resolved by slug on the server, which is also what preserves the
          // title, excerpt, image and metadata this body-only write omits.
          ...(version ? { expectedUpdatedAt: version.updatedAt } : {}),
        });
        if (res.success) {
          if (getDocumentEpoch() === writeEpoch) {
            toast.success(successMessage ?? 'Region updated and published');
            onCopyRegionSaved(copyRegionId, body, res.data);
            router.refresh();
          }
          return true;
        }
        if (getDocumentEpoch() === writeEpoch) {
          toast.error(res.error ?? errorMessage ?? 'Failed to save copy region');
        }
        onRollback?.();
        return false;
      } catch {
        if (getDocumentEpoch() === writeEpoch) {
          toast.error(errorMessage ?? 'Failed to save changes');
        }
        onRollback?.();
        return false;
      } finally {
        setSavingBackend(false);
      }
    },
    [
      saveContentWithEdgeApi,
      setSavingBackend,
      onCopyRegionSaved,
      getCopyRegionVersion,
      router,
      getDocumentEpoch,
      documentReadRefusal,
    ]
  );

  /** Mutate one block, commit it to history, and persist the document. */
  const writeToBlock = useCallback(
    async ({
      blockIndex,
      blocks,
      mutate,
      successMessage,
      errorMessage,
      coalesceKey,
    }: WriteToBlockArgs): Promise<boolean> => {
      const refusal = documentReadRefusal();
      if (refusal) {
        toast.error(refusal);
        return false;
      }
      const targetBlock = blocks[blockIndex];
      if (!targetBlock) {
        toast.error(errorMessage ?? 'Failed to save changes');
        return false;
      }
      const next = mutate(targetBlock);
      if (!next || next === targetBlock) return true; // nothing applies — no write
      const updatedBlocks = [...blocks];
      updatedBlocks[blockIndex] = next;
      commitBlocks(updatedBlocks, coalesceKey);
      const result = await handlePersistBlocks(updatedBlocks, successMessage);
      return result.success;
    },
    [commitBlocks, documentReadRefusal, handlePersistBlocks]
  );

  return { writeToCopyRegion, writeToBlock };
}
