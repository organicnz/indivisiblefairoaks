'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSettingsStore } from '@/lib/store/settings';
import { createClient } from '@/lib/supabase';

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      useSettingsStore.getState().reset();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="inline-flex items-center gap-4 px-10 py-5 bg-secondary text-white rounded-full font-black uppercase tracking-[0.2em] text-sm hover:bg-primary transition-all group shadow-xl shadow-secondary/10 disabled:opacity-50"
    >
      {isLoggingOut ? 'Signing Out...' : 'Sign Out Now'}
      <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
