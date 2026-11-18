'use client';

import { useCallback, useEffect, useState } from 'react';
import { copyText } from './clipboard';

type CopyStatus = 'idle' | 'copied' | 'error';

export function useCopyStatus() {
  const [copyState, setCopyState] = useState<CopyStatus>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2_400);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const copy = useCallback(async (text: string) => {
    try {
      await copyText(text);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }, []);

  return { copyState, copy };
}
