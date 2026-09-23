import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase';
import { updateUserSettingsAction } from '../actions/settings';

export interface UserSettings {
  marketing_emails: boolean;
  order_updates: boolean;
  preferred_currency: string;
}

interface SettingsState {
  settings: UserSettings;
  isLoading: boolean;
  error: string | null;
  initialize: (initialSettings: Partial<UserSettings> | null) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  fetchSettings: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  marketing_emails: false,
  order_updates: true,
  preferred_currency: 'NZD',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isLoading: false,
      error: null,

      initialize: (initialSettings) => {
        if (initialSettings) {
          set({ settings: { ...DEFAULT_SETTINGS, ...initialSettings } });
        } else {
          // If settings are null (e.g. logged out), reset to defaults
          set({ settings: DEFAULT_SETTINGS });
        }
      },

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        const supabase = createClient();

        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('settings')
            .eq('user_id', user.id)
            .single();

          if (error && user.email) {
            // Try legacy email match if user_id fails
            const { data: emailData, error: emailError } = await supabase
              .from('profiles')
              .select('settings')
              .eq('email', user.email)
              .single();

            if (emailError) {
              if (emailError.code !== 'PGRST116') throw emailError;
            } else if (emailData?.settings) {
              set({
                settings: {
                  ...DEFAULT_SETTINGS,
                  ...(emailData.settings as Record<string, unknown>),
                },
              });
            }
          } else if (data?.settings) {
            set({
              settings: {
                ...DEFAULT_SETTINGS,
                ...(data.settings as Record<string, unknown>),
              },
            });
          }
        } catch (err: unknown) {
          set({ error: (err as Error).message });
        } finally {
          set({ isLoading: false });
        }
      },

      updateSettings: async (newSettings: Partial<UserSettings>) => {
        const previousSettings = get().settings;
        const updatedSettings = { ...previousSettings, ...newSettings };

        // Optimistic update
        set({ settings: updatedSettings, error: null });

        try {
          const result = await updateUserSettingsAction(newSettings);
          if (result.error) throw new Error(result.error);
        } catch (err: unknown) {
          // Revert on error
          set({ settings: previousSettings, error: (err as Error).message });
        }
      },

      reset: () => {
        set({ settings: DEFAULT_SETTINGS, error: null, isLoading: false });
      },
    }),
    {
      name: 'indivisiblefairoaks-settings-v2', // Changed version to reset potentially stale cache
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
