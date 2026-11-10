// @vitest-environment jsdom-same-realm
import { describe, expect, it } from 'vitest';
import { type Block, parseHtml, serializeBlocks } from '@/lib/blocks';
import { EMPTY_HISTORY, record } from '@/lib/editor-history';
import {
  type ImageHistoryRun,
  type ImageHistoryTarget,
  repairImageHistory,
} from '@/lib/visual-edit/image-history';

const OLD_SRC = 'https://example.com/old.jpg';
const FIRST_SRC = 'https://example.com/first.jpg';
const FAILED_SRC = 'https://example.com/failed.jpg';
const SAVED_SRC = 'https://example.com/saved.jpg';

function imageBlock(src: string): Block {
  return {
    id: 'image-1',
    type: 'image',
    src,
    alt: 'Old',
    caption: '',
    width: null,
    height: null,
  };
}

describe('image history repair', () => {
  it('removes a failed run and preserves a later unrelated undo step', () => {
    const base: Block[] = [imageBlock(OLD_SRC), { id: 'paragraph-1', type: 'paragraph', html: 'Intro' }];
    const afterImage = base.map((block) =>
      block.type === 'image' ? { ...block, src: FAILED_SRC } : block
    );
    const afterEdit = afterImage.map((block) =>
      block.type === 'paragraph' ? { ...block, html: `${block.html} changed` } : block
    );
    const target: ImageHistoryTarget = {
      blockId: 'image-1',
      blockIndex: 0,
      imageOrdinal: 0,
      historyKey: 'image-session-1',
    };
    const run: ImageHistoryRun = {
      historyKey: target.historyKey,
      failureKey: 'image-session-1:1',
      failedImages: [{ src: FAILED_SRC, alt: 'Old' }],
    };

    let history = record(
      EMPTY_HISTORY,
      serializeBlocks(base),
      serializeBlocks(afterImage),
      run.failureKey,
      1000
    );
    history = record(
      history,
      serializeBlocks(afterImage),
      serializeBlocks(afterEdit),
      'paragraph:edit',
      2000
    );

    const repaired = repairImageHistory(history, target, run, OLD_SRC, 'Old');
    expect(repaired.past).toHaveLength(1);
    expect(repaired.past[0].key).toBe('paragraph:edit');

    const beforeEdit = parseHtml(repaired.past[0].snapshot);
    expect(beforeEdit.find((block) => block.type === 'image')).toMatchObject({
      type: 'image',
      src: OLD_SRC,
      alt: 'Old',
    });
    expect(beforeEdit.find((block) => block.type === 'paragraph')).toMatchObject({
      type: 'paragraph',
      html: 'Intro',
    });
  });

  it('keeps the successful write as the undo boundary and rewrites rich text', () => {
    const base: Block[] = [
      { id: 'intro', type: 'paragraph', html: `Intro <img src="${OLD_SRC}" alt="Old">` },
      { id: 'sibling', type: 'paragraph', html: 'Unrelated' },
    ];
    const afterFailure = base.map((block) =>
      block.type === 'paragraph' && block.id === 'intro'
        ? { ...block, html: block.html.replace(OLD_SRC, FAILED_SRC) }
        : block
    );
    const afterSaved = afterFailure.map((block) =>
      block.type === 'paragraph' && block.id === 'intro'
        ? { ...block, html: block.html.replace(FAILED_SRC, SAVED_SRC) }
        : block
    );
    const target: ImageHistoryTarget = {
      blockId: 'intro',
      blockIndex: 0,
      imageOrdinal: 0,
      historyKey: 'image-session-2',
    };
    const run: ImageHistoryRun = {
      historyKey: target.historyKey,
      failureKey: 'image-session-2:1',
      failedImages: [{ src: FAILED_SRC, alt: 'Old' }],
    };

    let history = record(
      EMPTY_HISTORY,
      serializeBlocks(base),
      serializeBlocks(afterFailure),
      run.failureKey,
      1000
    );
    history = record(
      history,
      serializeBlocks(afterFailure),
      serializeBlocks(afterSaved),
      'image-session-2:2',
      2000
    );

    const repaired = repairImageHistory(history, target, run, OLD_SRC, 'Old', {
      successfulKey: 'image-session-2:2',
    });
    expect(repaired.past).toHaveLength(1);
    expect(repaired.past[0].key).toBe('image-session-2:2');

    const beforeSaved = parseHtml(repaired.past[0].snapshot);
    const introBefore = beforeSaved[0];
    expect(introBefore?.type).toBe('paragraph');
    if (introBefore?.type === 'paragraph') {
      expect(introBefore.html).toContain(OLD_SRC);
      expect(introBefore.html).not.toContain(FAILED_SRC);
      expect(introBefore.html).not.toContain(SAVED_SRC);
    }
    expect(beforeSaved[1]).toMatchObject({ type: 'paragraph', html: 'Unrelated' });
  });

  it('preserves an earlier saved image and an interleaved edit', () => {
    const base: Block[] = [imageBlock(OLD_SRC), { id: 'paragraph-1', type: 'paragraph', html: 'Intro' }];
    const afterFirst = base.map((block) =>
      block.type === 'image' ? { ...block, src: FIRST_SRC } : block
    );
    const afterFailure = afterFirst.map((block) =>
      block.type === 'image' ? { ...block, src: FAILED_SRC } : block
    );
    const afterEdit = afterFailure.map((block) =>
      block.type === 'paragraph' ? { ...block, html: 'Intro changed' } : block
    );
    const afterSaved = afterEdit.map((block) =>
      block.type === 'image' ? { ...block, src: SAVED_SRC } : block
    );
    const target: ImageHistoryTarget = {
      blockId: 'image-1',
      blockIndex: 0,
      imageOrdinal: 0,
      historyKey: 'image-session-3',
    };
    const run: ImageHistoryRun = {
      historyKey: target.historyKey,
      failureKey: 'image-session-3:2',
      failedImages: [{ src: FAILED_SRC, alt: 'Old' }],
    };

    let history = record(
      EMPTY_HISTORY,
      serializeBlocks(base),
      serializeBlocks(afterFirst),
      'image-session-3:1',
      1000
    );
    history = record(
      history,
      serializeBlocks(afterFirst),
      serializeBlocks(afterFailure),
      run.failureKey,
      2000
    );
    history = record(
      history,
      serializeBlocks(afterFailure),
      serializeBlocks(afterEdit),
      'paragraph:edit',
      3000
    );
    history = record(
      history,
      serializeBlocks(afterEdit),
      serializeBlocks(afterSaved),
      'image-session-3:3',
      4000
    );

    const repaired = repairImageHistory(history, target, run, FIRST_SRC, 'Old', {
      successfulKey: 'image-session-3:3',
    });
    expect(repaired.past.map((entry) => entry.key)).toEqual([
      'image-session-3:1',
      'paragraph:edit',
      'image-session-3:3',
    ]);

    const prior = parseHtml(repaired.past[0].snapshot);
    expect(prior.find((block) => block.type === 'image')).toMatchObject({
      type: 'image',
      src: OLD_SRC,
    });

    const beforeEdit = parseHtml(repaired.past[1].snapshot);
    expect(beforeEdit.find((block) => block.type === 'image')).toMatchObject({
      type: 'image',
      src: FIRST_SRC,
    });
    expect(beforeEdit.find((block) => block.type === 'paragraph')).toMatchObject({
      type: 'paragraph',
      html: 'Intro',
    });

    const beforeSaved = parseHtml(repaired.past[2].snapshot);
    expect(beforeSaved.find((block) => block.type === 'image')).toMatchObject({
      type: 'image',
      src: FIRST_SRC,
    });
    expect(beforeSaved.find((block) => block.type === 'paragraph')).toMatchObject({
      type: 'paragraph',
      html: 'Intro changed',
    });
  });

  it('rewrites every failed image from a multi-attempt run', () => {
    const failedA = 'https://example.com/failed-a.jpg';
    const failedB = 'https://example.com/failed-b.jpg';
    const base: Block[] = [imageBlock(OLD_SRC), { id: 'paragraph-1', type: 'paragraph', html: 'Intro' }];
    const afterFirst = base.map((block) =>
      block.type === 'image' ? { ...block, src: failedA } : block
    );
    const afterSecond = afterFirst.map((block) =>
      block.type === 'image' ? { ...block, src: failedB } : block
    );
    const afterEdit = afterSecond.map((block) =>
      block.type === 'paragraph' ? { ...block, html: 'Intro changed' } : block
    );
    const afterSaved = afterEdit.map((block) =>
      block.type === 'image' ? { ...block, src: SAVED_SRC } : block
    );
    const target: ImageHistoryTarget = {
      blockId: 'image-1',
      blockIndex: 0,
      imageOrdinal: 0,
      historyKey: 'image-session-5',
    };
    const run: ImageHistoryRun = {
      historyKey: target.historyKey,
      failureKey: 'image-session-5:1',
      failedImages: [
        { src: failedA, alt: 'Old' },
        { src: failedB, alt: 'Old' },
      ],
    };

    let history = record(
      EMPTY_HISTORY,
      serializeBlocks(base),
      serializeBlocks(afterFirst),
      'image-session-5:1',
      1000
    );
    history = record(
      history,
      serializeBlocks(afterFirst),
      serializeBlocks(afterSecond),
      'image-session-5:2',
      2000
    );
    history = record(
      history,
      serializeBlocks(afterSecond),
      serializeBlocks(afterEdit),
      'paragraph:edit',
      3000
    );
    history = record(
      history,
      serializeBlocks(afterEdit),
      serializeBlocks(afterSaved),
      'image-session-5:4',
      4000
    );

    const repaired = repairImageHistory(history, target, run, OLD_SRC, 'Old', {
      successfulKey: 'image-session-5:4',
    });
    expect(repaired.past.map((entry) => entry.key)).toEqual([
      'paragraph:edit',
      'image-session-5:4',
    ]);

    const beforeEdit = parseHtml(repaired.past[0].snapshot);
    expect(beforeEdit.find((block) => block.type === 'image')).toMatchObject({
      type: 'image',
      src: OLD_SRC,
      alt: 'Old',
    });
    expect(beforeEdit.find((block) => block.type === 'paragraph')).toMatchObject({
      type: 'paragraph',
      html: 'Intro',
    });

    const beforeSaved = parseHtml(repaired.past[1].snapshot);
    expect(beforeSaved.find((block) => block.type === 'image')).toMatchObject({
      type: 'image',
      src: OLD_SRC,
      alt: 'Old',
    });
    expect(beforeSaved.find((block) => block.type === 'paragraph')).toMatchObject({
      type: 'paragraph',
      html: 'Intro changed',
    });
    for (const snapshot of [repaired.past[0].snapshot, repaired.past[1].snapshot]) {
      expect(snapshot).not.toContain(failedA);
      expect(snapshot).not.toContain(failedB);
      expect(snapshot).not.toContain(SAVED_SRC);
    }
  });

  it('keeps the checkpoint when a retry persisted the preview already in the model', () => {
    const base: Block[] = [imageBlock(OLD_SRC), { id: 'paragraph-1', type: 'paragraph', html: 'Intro' }];
    const afterFailure = base.map((block) =>
      block.type === 'image' ? { ...block, src: FAILED_SRC } : block
    );
    const target: ImageHistoryTarget = {
      blockId: 'image-1',
      blockIndex: 0,
      imageOrdinal: 0,
      historyKey: 'image-session-4',
    };
    const run: ImageHistoryRun = {
      historyKey: target.historyKey,
      failureKey: 'image-session-4:1',
      failedImages: [{ src: FAILED_SRC, alt: 'Old' }],
    };
    const history = record(
      EMPTY_HISTORY,
      serializeBlocks(base),
      serializeBlocks(afterFailure),
      run.failureKey,
      1000
    );

    const repaired = repairImageHistory(history, target, run, OLD_SRC, 'Old', {
      successfulKey: 'image-session-4:2',
    });
    expect(repaired).toBe(history);
  });
});
