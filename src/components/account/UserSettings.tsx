'use client';

import { Bell, CheckCircle2, CreditCard, Loader2, Mail } from 'lucide-react';
import { useSettingsStore } from '@/lib/store/settings';

export function UserSettings() {
  const { settings, isLoading, error, updateSettings } = useSettingsStore();

  const handleToggle = async (key: keyof typeof settings) => {
    await updateSettings({ [key]: !settings[key] });
  };

  const handleCurrencyChange = async (currency: string) => {
    await updateSettings({ preferred_currency: currency });
  };

  if (isLoading && !settings) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-12 mt-16 animate-in fade-in duration-300 ease-out">
      <div className="flex flex-col mb-8">
        <h2 className="text-2xl font-black text-secondary uppercase tracking-widest mb-2 inline-block">
          Preferences
        </h2>
        <div className="h-1 w-12 bg-primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Notifications */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-slate-50 text-secondary rounded-2xl">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-secondary uppercase tracking-tight">
                Notifications
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Manage how we reach you
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group transition-all hover:bg-white hover:shadow-inner border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-slate-400" />
                <div>
                  <p className="text-xs font-black text-secondary uppercase tracking-wider">
                    Marketing Emails
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    New gear & exclusive offers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('marketing_emails')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  settings.marketing_emails ? 'bg-primary' : 'bg-slate-200'
                }`}
                aria-label="Toggle marketing emails"
                aria-checked={settings.marketing_emails}
                role="switch"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.marketing_emails ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group transition-all hover:bg-white hover:shadow-inner border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-slate-400" />
                <div>
                  <p className="text-xs font-black text-secondary uppercase tracking-wider">
                    Order Updates
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Tracking & delivery status
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('order_updates')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  settings.order_updates ? 'bg-primary' : 'bg-slate-200'
                }`}
                aria-label="Toggle order updates"
                aria-checked={settings.order_updates}
                role="switch"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.order_updates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Currency & Localization */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-slate-50 text-secondary rounded-2xl">
              <CreditCard size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-secondary uppercase tracking-tight">
                Localization
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Preferred shopping experience
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <label
                htmlFor="currency-select"
                className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-4 ml-1"
              >
                Preferred Currency
              </label>
              <div id="currency-select" className="grid grid-cols-3 gap-2">
                {['NZD', 'AUD', 'USD'].map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => handleCurrencyChange(curr)}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      settings.preferred_currency === curr
                        ? 'bg-secondary text-white shadow-lg shadow-secondary/20'
                        : 'bg-white text-slate-400 hover:text-secondary border border-slate-100'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest text-center animate-in slide-in-from-top-2 duration-300">
          Error: {error}
          <p className="mt-1 text-[8px] opacity-60">
            If this persists, please try a hard reload (Cmd+Shift+R)
          </p>
        </div>
      )}

      {!error && !isLoading && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2">
          <CheckCircle2 size={14} />
          Settings are synced with the cloud
        </div>
      )}
    </div>
  );
}
