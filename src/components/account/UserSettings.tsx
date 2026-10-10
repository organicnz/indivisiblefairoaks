'use client';

import { Bell, CheckCircle2, Loader2, Mail, MapPin, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { CURRENCY_CODE } from '@/config/commerce';
import { useSettingsStore } from '@/lib/store/settings';

export function UserSettings() {
  const { settings, isLoading, error, errorReason, updateSettings } = useSettingsStore();

  const handleToggle = async (key: keyof typeof settings) => {
    await updateSettings({ [key]: !settings[key] });
  };

  if (isLoading && !settings) {
    return (
      <div className="flex justify-center p-12" role="status" aria-label="Loading settings">
        <Loader2
          className="animate-spin text-primary dark:text-primary-on-dark"
          size={32}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="space-y-12 mt-16 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out">
      <div className="flex flex-col mb-8">
        <h2 className="text-2xl font-black text-secondary uppercase tracking-tighterer mb-2 inline-block">
          Preferences
        </h2>
        <div className="h-1 w-12 bg-primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Notifications */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-surface-muted text-secondary rounded-2xl">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-secondary uppercase tracking-tighter">
                Notifications
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Manage how we reach you
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface-muted rounded-2xl group transition-all hover:bg-surface-card hover:shadow-inner border border-transparent hover:border-border">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-xs font-black text-secondary uppercase tracking-wider">
                    Marketing Emails
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    New gear & exclusive offers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('marketing_emails')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  settings.marketing_emails ? 'bg-primary' : 'bg-slate-300'
                }`}
                aria-checked={settings.marketing_emails}
                role="switch"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-out ${
                    settings.marketing_emails ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-muted rounded-2xl group transition-all hover:bg-surface-card hover:shadow-inner border border-transparent hover:border-border">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-xs font-black text-secondary uppercase tracking-wider">
                    Order Updates
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Tracking & delivery status
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('order_updates')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  settings.order_updates ? 'bg-primary' : 'bg-slate-300'
                }`}
                aria-checked={settings.order_updates}
                role="switch"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-out ${
                    settings.order_updates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Store region */}
        <div className="bg-surface-card border border-border rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-surface-muted text-secondary rounded-2xl">
              <MapPin size={24} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-black text-secondary uppercase tracking-tighterer">
                Store Region
              </h3>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
                Where we ship and what we charge
              </p>
            </div>
          </div>

          {/*
            This card used to offer a three-way currency picker (NZD/AUD/USD) that
            wrote `preferred_currency` and changed nothing — the storefront has a
            single price list, so the control was a lie that read as broken software.
            It is replaced by the two facts a shopper actually needs.
          */}
          <dl className="space-y-4">
            <div className="p-4 bg-surface-muted rounded-2xl flex items-center justify-between gap-4">
              <dt className="text-xs font-black text-secondary uppercase tracking-wider">
                Currency
              </dt>
              <dd className="text-sm font-bold text-primary-ink">{CURRENCY_CODE}</dd>
            </div>
            <div className="p-4 bg-surface-muted rounded-2xl flex items-center justify-between gap-4">
              <dt className="text-xs font-black text-secondary uppercase tracking-wider">
                Ships from
              </dt>
              <dd className="text-sm font-bold text-primary-ink text-right">Carmichael, CA</dd>
            </div>
          </dl>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-accent-red text-xs font-bold uppercase tracking-wider text-center motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:duration-300 motion-safe:ease-out"
        >
          {error}
          {/*
            The advice under a failure is the whole point of the panel. It used to
            say "try a hard reload (Cmd+Shift+R)" unconditionally, which is true
            and useless when the cause is an AAL1 session: the reload cannot
            change the assurance level, so the toggle just reverts again. A
            step-up requirement gets the one action that does fix it; anything
            else keeps the reload hint, because there the reload is the advice.
          */}
          {errorReason === 'step_up_required' ? (
            <p className="mt-3">
              <Link
                href="/auth/mfa?next=/account?tab=settings"
                className="inline-flex items-center gap-2 rounded-full bg-accent-red px-5 py-2.5 text-white normal-case tracking-normal transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2"
              >
                <ShieldCheck size={14} aria-hidden="true" />
                Complete the security check
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-[11px] font-medium normal-case tracking-normal opacity-80">
              If this persists, please try a hard reload (Cmd+Shift+R)
            </p>
          )}
        </div>
      )}

      {!error && !isLoading && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          Settings are synced with the cloud
        </div>
      )}
    </div>
  );
}
