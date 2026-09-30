import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ContentImageInput } from '@/components/admin/content/ContentImageInput';

const uploadContentImage = vi.hoisted(() => vi.fn());
const deleteContentImage = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({ uploadContentImage, deleteContentImage }));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/image', () => ({
  // A stand-in, not an image. This suite is about the URL probe, and neither
  // `next/image`'s loader nor its rendered markup is under test — so it renders
  // a marker element rather than an `<img>`, which would only draw a real
  // layout-shift question into a suite with nothing to say about layout.
  // It has to return elements, not DOM nodes.
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span data-testid="image-preview" data-src={src} data-alt={alt} />
  ),
}));

const env = (await import('@/lib/env')).env as unknown as Record<string, string | undefined>;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A stand-in for the DOM `Image` constructor.
 *
 * It records every instance so a test can decide *when* a load finishes, rather
 * than racing a real network request. That is what makes "the probe does not
 * fire for our own uploads" and "a failed probe changes nothing" assertable at
 * all — both are statements about a request that must not happen, and a real
 * `Image` would make the negative case unobservable.
 */
class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  src = '';
  constructor() {
    FakeImage.instances.push(this);
  }
  /** Succeed with a size, as a real load would. */
  resolve(width: number, height: number) {
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.onload?.();
  }
  /** Fail, as a 404 or a CORS-free load error would. */
  reject() {
    this.onerror?.();
  }
}

const PROBE_DEBOUNCE_MS = 600;
/** A host that is deliberately not ours, so the probe is allowed to run. */
const EXTERNAL = 'https://photos.example.net/rally.jpg';

describe('ContentImageInput, measuring a typed URL', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: Mock<
    (url: string, dimensions?: { width: number | null; height: number | null }) => void
  >;
  let originalImage: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    env.NEXT_PUBLIC_SITE_URL = 'https://indivisiblefairoaks.org';
    FakeImage.instances = [];
    originalImage = window.Image;
    window.Image = FakeImage as unknown as typeof window.Image;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.Image = originalImage as typeof window.Image;
    vi.useRealTimers();
  });

  const render = (value: string) =>
    act(() => {
      root.render(
        <ContentImageInput value={value} onChange={onChange} label="Image" hint="optional" />
      );
    });

  const settleProbe = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROBE_DEBOUNCE_MS);
    });
  };

  /**
   * Deliver a load event and let the probe's promise continuation run.
   *
   * `resolve` is synchronous but the `onChange` it triggers is not: it happens
   * in a `.then` after the promise settles, so a plain `act` would assert before
   * the emission and report zero calls.
   */
  const resolveProbe = async (width: number, height: number) => {
    const probe = FakeImage.instances.at(-1);
    await act(async () => {
      probe?.resolve(width, height);
    });
    return probe;
  };

  /** The failure counterpart: a 404, an unreachable host, an abandoned decode. */
  const rejectProbe = async () => {
    const probe = FakeImage.instances.at(-1);
    await act(async () => {
      probe?.reject();
    });
    return probe;
  };

  it('attaches the measured size to a URL the author typed', async () => {
    render(EXTERNAL);
    expect(FakeImage.instances).toHaveLength(0);

    await settleProbe();
    expect(FakeImage.instances).toHaveLength(1);
    expect(FakeImage.instances[0]?.src).toBe(EXTERNAL);

    await resolveProbe(1400, 933);

    // The URL is re-emitted unchanged so `src` and the dimensions land as one
    // update. The consumer replaces the whole image block, so emitting `src`
    // alone would be a second, separate change to the same field.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(EXTERNAL, { width: 1400, height: 933 });
  });

  it('does not probe a half-typed URL', async () => {
    // Every prefix of a pasted URL is a plausible keystroke sequence, and a
    // probe per prefix is a request storm against a third-party host.
    for (const partial of ['h', 'https://', 'https://photos.example.net', 'https://photos.']) {
      FakeImage.instances = [];
      render(partial);
      await settleProbe();
      expect(FakeImage.instances).toHaveLength(0);
    }
  });

  it('does not probe our own uploads, which the server already measured', async () => {
    // The uploader measures from the bytes it just wrote, which is
    // authoritative. Probing our own media would spend a request to re-learn
    // what we already know.
    render('https://indivisiblefairoaks.org/media/rally.jpg');
    await settleProbe();
    expect(FakeImage.instances).toHaveLength(0);
  });

  it('probes each distinct URL once, however often the parent re-renders', async () => {
    render(EXTERNAL);
    await settleProbe();
    expect(FakeImage.instances).toHaveLength(1);
    await resolveProbe(800, 600);

    // Same value, new render — the author typing in another field, or an
    // autosave round trip. Re-probing here would be a request per keystroke
    // anywhere in the editor.
    for (let i = 0; i < 3; i += 1) render(EXTERNAL);
    await settleProbe();
    expect(FakeImage.instances).toHaveLength(1);
  });

  it('leaves the URL committed when the probe fails', async () => {
    render(EXTERNAL);
    await settleProbe();
    await rejectProbe();

    // A 404 must not stop the author pointing at the image — they may be
    // fixing the host, or the file may appear later. What must not happen is a
    // second `onChange` writing `null` over `null`, which is a no-op the author
    // would have to undo.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats a zero dimension as unknown rather than as a size', async () => {
    render(EXTERNAL);
    await settleProbe();
    await resolveProbe(0, 933);

    // `width="0"` reserves nothing and renders nothing, so it is strictly worse
    // than emitting no attribute at all.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cancels a probe when the author keeps typing', async () => {
    render('https://photos.example.net/rally.jpg');
    // Advance most of the way, then change the URL before the timer fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROBE_DEBOUNCE_MS - 50);
    });
    render('https://photos.example.net/march-rally.jpg');
    await settleProbe();

    // Exactly one probe, and it is for the URL that was left standing.
    expect(FakeImage.instances).toHaveLength(1);
    expect(FakeImage.instances[0]?.src).toBe('https://photos.example.net/march-rally.jpg');
  });

  it('emits the URL once even when the browser fires both load and error', async () => {
    render(EXTERNAL);
    await settleProbe();
    const probe = await resolveProbe(640, 480);
    expect(onChange).toHaveBeenCalledTimes(1);

    // A real image can emit `load` and then `error` when a decode is abandoned
    // or the connection drops mid-flight. The author must still end up with one
    // edit, not two.
    //
    // Note what is *not* holding this line: the probe's promise, which can only
    // settle once. An earlier version of this test claimed the handler
    // detachment was load-bearing, and a mutation proved it was not — detaching
    // them changes nothing observable. They are released so the closures do not
    // outlive the probe, which is hygiene rather than correctness.
    await act(async () => {
      probe?.onload?.();
      probe?.reject();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(EXTERNAL, { width: 640, height: 480 });
  });
});
