'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ActionResult, ContentInput } from '@/lib/actions/content';
import type { Block } from '@/lib/blocks';
import { copyRegionSlug } from '@/lib/copy-regions';

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

export interface UseBlockWriterArgs {
  commitBlocks: (next: Block[], coalesceKey?: string | null) => void;
  handlePersistBlocks: (newBlocks: Block[], successMessage?: string) => Promise<void>;
  saveContentWithEdgeApi: (
    payload: ContentInput
  ) => Promise<ActionResult<{ id: number; updatedAt: string | null }>>;
  setSavingBackend: (v: boolean) => void;
  setSavedBody: (v: string) => void;
  router: { refresh: () => void };
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
    setSavedBody,
    router,
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
      const regionContainer = document.querySelector<HTMLElement>(
        `[data-copy-region="${copyRegionId}"]`
      );
      if (!regionContainer) {
        toast.error(errorMessage ?? 'Failed to save copy region');
        onRollback?.();
        return false;
      }
      const body = regionContainer.innerHTML;
      setSavingBackend(true);
      try {
        const res = await saveContentWithEdgeApi({
          slug: copyRegionSlug(copyRegionId),
          title: copyRegionId,
          body,
          status: 'publish',
          type: 'page',
        });
        if (res.success) {
          toast.success(successMessage ?? 'Region updated and published');
          setSavedBody(body);
          router.refresh();
          return true;
        }
        toast.error(res.error ?? errorMessage ?? 'Failed to save copy region');
        onRollback?.();
        return false;
      } catch {
        toast.error(errorMessage ?? 'Failed to save changes');
        onRollback?.();
        return false;
      } finally {
        setSavingBackend(false);
      }
    },
    [saveContentWithEdgeApi, setSavingBackend, setSavedBody, router]
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
      await handlePersistBlocks(updatedBlocks, successMessage);
      return true;
    },
    [commitBlocks, handlePersistBlocks]
  );

  return { writeToCopyRegion, writeToBlock };
}
