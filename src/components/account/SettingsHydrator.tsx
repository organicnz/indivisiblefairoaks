'use client';

import { useEffect, useRef } from 'react';
import { type UserSettings, useSettingsStore } from '@/lib/store/settings';

export function SettingsHydrator({ settings }: { settings: UserSettings | null }) {
  const initialize = useSettingsStore((state) => state.initialize);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialize(settings);
      initialized.current = true;
    }
  }, [settings, initialize]);

  return null;
}
