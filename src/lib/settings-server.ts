import { unstable_cache } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';

export interface UserSettings {
  marketing_emails: boolean;
  order_updates: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  marketing_emails: false,
  order_updates: true,
};

/**
 * Fetches user settings from the database with Next.js caching.
 * Optionally merges with cookies for critical SSR settings.
 */
export async function getUserSettings(email: string): Promise<UserSettings> {
  const cachedSettings = await unstable_cache(
    async (userEmail: string) => {
      const supabase = await createServerClient();

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('settings')
          .eq('email', userEmail)
          .single();

        if (error || !data?.settings) {
          return DEFAULT_SETTINGS;
        }

        return { ...DEFAULT_SETTINGS, ...(data.settings as Record<string, unknown>) };
      } catch (err) {
        console.error('Error fetching settings from DB:', err);
        return DEFAULT_SETTINGS;
      }
    },
    [`user-settings-${email}`],
    {
      tags: [`user-settings-${email}`],
      revalidate: 3600,
    }
  )(email);
  return cachedSettings;
}
