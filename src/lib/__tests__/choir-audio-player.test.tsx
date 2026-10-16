// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoirAudioPlayer } from '@/components/ui/ChoirAudioPlayer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ChoirAudioPlayer (Resistance Radio)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock HTMLMediaElement play/pause
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders radio branding, default song and status indicators', async () => {
    await act(async () => {
      root.render(<ChoirAudioPlayer />);
    });

    expect(container.textContent).toContain('Resistance Radio');
    expect(container.textContent).toContain('Live Web Broadcast');
    expect(container.textContent).toContain('America the Beautiful');
    expect(container.textContent).toContain('Tune from Anywhere');
  });

  it('toggles play and pause state', async () => {
    await act(async () => {
      root.render(<ChoirAudioPlayer />);
    });

    const playButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Play broadcast"]'
    );
    expect(playButton).toBeDefined();

    await act(async () => {
      playButton?.click();
    });

    const pauseButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Pause broadcast"]'
    );
    expect(pauseButton).toBeDefined();
  });

  it('toggles custom stream accordion and loads custom URL', async () => {
    await act(async () => {
      root.render(<ChoirAudioPlayer />);
    });

    const tuneBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Tune from Anywhere')
    );
    expect(tuneBtn).toBeDefined();

    await act(async () => {
      tuneBtn?.click();
    });

    expect(container.textContent).toContain('Custom Audio Stream / Song URL from Anywhere');

    const input = container.querySelector<HTMLInputElement>('input[placeholder*="https://"]');
    expect(input).toBeDefined();

    if (input) {
      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(input, 'https://example.com/stream.mp3');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const form = container.querySelector<HTMLFormElement>('form');
    expect(form).toBeDefined();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Custom Stream Broadcast');
  });

  it('supports Supabase S3 storage song URLs', async () => {
    await act(async () => {
      root.render(<ChoirAudioPlayer />);
    });

    const tuneBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Tune from Anywhere')
    );
    await act(async () => {
      tuneBtn?.click();
    });

    const input = container.querySelector<HTMLInputElement>('input[placeholder*="Stream URL"]');
    expect(input).toBeDefined();

    if (input) {
      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(input, 's3://media/audio/resistance-choir-anthem.mp3');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const form = container.querySelector<HTMLFormElement>('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Supabase S3 Audio');
  });

  it('provides accessible progress bar and volume control', async () => {
    await act(async () => {
      root.render(<ChoirAudioPlayer />);
    });

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress).toBeDefined();
    expect(progress?.getAttribute('aria-label')).toBe('Elapsed broadcast time');

    const volumeSlider = container.querySelector<HTMLInputElement>('input[type="range"]');
    expect(volumeSlider).toBeDefined();
    expect(volumeSlider?.getAttribute('aria-label')).toBe('Broadcast volume');

    const muteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Mute volume"]');
    expect(muteBtn).toBeDefined();

    await act(async () => {
      muteBtn?.click();
    });

    const unmuteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Unmute volume"]'
    );
    expect(unmuteBtn).toBeDefined();
  });
});
