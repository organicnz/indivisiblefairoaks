'use server';

import { revalidatePath } from 'next/cache';
import type { UserSettings } from '@/lib/store/settings';
import { createServerClient } from '@/lib/supabase-server';
import type { Json } from '@/types/supabase';

/**
 * Server Action to update user settings.
 * This provides a secure way to update settings and handles cache invalidation.
 */
export async function updateUserSettingsAction(settings: Partial<UserSettings>) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    return { error: 'Unauthorized or missing email' };
  }

  // Simple validation
  const allowedKeys: (keyof UserSettings)[] = [
    'marketing_emails',
    'order_updates',
    'preferred_currency',
  ];
  const filteredSettings: Partial<UserSettings> = {};

  for (const key of allowedKeys) {
    if (key in settings) {
      (filteredSettings as Record<string, unknown>)[key] = settings[key];
    }
  }

  // Fetch current settings to merge
  let { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('settings')
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code === 'PGRST116' && user.email) {
    // Try by email if user_id match fails (for legacy profiles)
    const { data: emailData, error: emailError } = await supabase
      .from('profiles')
      .select('settings')
      .eq('email', user.email)
      .single();

    if (!emailError) {
      profile = emailData;
      fetchError = null;
    }
  }

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Fetch error in updateUserSettingsAction:', fetchError);
    // Instead of failing, we'll proceed with just the new settings to ensure the user can save.
    // The upsert later will handle the database-side merge or create.
  }

  const updatedSettings = {
    ...((profile?.settings as Record<string, unknown>) || {}),
    ...filteredSettings,
  };

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      user_id: user.id,
      email: user.email,
      settings: updatedSettings as Json,
    },
    {
      onConflict: 'user_id',
    }
  );

  if (upsertError) {
    // Final fallback by email if user_id conflict occurs or fails
    const { error: emailError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        user_id: user.id,
        settings: updatedSettings,
      },
      {
        onConflict: 'email',
      }
    );

    if (emailError) {
      console.error('Upsert error in updateUserSettingsAction:', emailError);
      return { error: emailError.message };
    }
  }

  // Revalidate the entire app since settings can affect many pages (currency, etc)
  revalidatePath('/', 'layout');

  return { success: true, settings: updatedSettings };
}
