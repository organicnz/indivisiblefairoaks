'use client';

import { Eye, EyeOff, Monitor, Printer, Smartphone, Tablet } from 'lucide-react';
import type { VisualComposerResponsivePreset, VisualComposerStyles } from '@/types/unified';
import { StudioInput, StudioSection, StudioToggle } from '../ui';

export const RESPONSIVE_PRESETS: readonly VisualComposerResponsivePreset[] = [
  {
    id: 'universal-all',
    name: 'Universal (All Screens)',
    description: 'Visible across all devices: mobile phones, tablets, desktops, and print',
    badge: 'All Devices',
    apply: () => ({
      hideMobile: false,
      hideTablet: false,
      hideDesktop: false,
      hidePrint: false,
    }),
  },
  {
    id: 'desktop-tablet-only',
    name: 'Desktop & Tablet Only',
    description: 'Hidden on mobile phones (<640px) to keep small mobile viewports clean',
    badge: 'Desktop/Tablet',
    apply: () => ({
      hideMobile: true,
      hideTablet: false,
      hideDesktop: false,
      hidePrint: false,
    }),
  },
  {
    id: 'mobile-only',
    name: 'Mobile Phone Only',
    description: 'Exclusive to mobile devices (<640px) such as quick action sheets and bottom bars',
    badge: 'Mobile Only',
    apply: () => ({
      hideMobile: false,
      hideTablet: true,
      hideDesktop: true,
      hidePrint: false,
    }),
  },
  {
    id: 'screen-only',
    name: 'Screen Only (Hide on Print)',
    description: 'Visible on all screens but hidden when generating paper or PDF prints',
    badge: 'Screen Only',
    apply: () => ({
      hideMobile: false,
      hideTablet: false,
      hideDesktop: false,
      hidePrint: true,
    }),
  },
] as const;

export const COMMON_ANCHOR_TARGETS = [
  'about',
  'rally-info',
  'volunteer',
  'donate',
  'contact',
  'actions',
] as const;

export interface MotionAdvancedStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  anchorIdInputId?: string;
  compiledClassNames?: string;
}

export function MotionAdvancedStudio({
  styles,
  setStyles,
  anchorIdInputId,
  compiledClassNames,
}: MotionAdvancedStudioProps) {
  const devices = [
    {
      key: 'hideMobile' as const,
      label: 'Mobile (<640px)',
      hidden: styles.responsive.hideMobile,
      icon: Smartphone,
    },
    {
      key: 'hideTablet' as const,
      label: 'Tablet (640-768px)',
      hidden: styles.responsive.hideTablet,
      icon: Tablet,
    },
    {
      key: 'hideDesktop' as const,
      label: 'Desktop (>768px)',
      hidden: styles.responsive.hideDesktop,
      icon: Monitor,
    },
    {
      key: 'hidePrint' as const,
      label: 'Print / Paper',
      hidden: styles.responsive.hidePrint,
      icon: Printer,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. HTML Anchor ID Target */}
      {anchorIdInputId && (
        <StudioSection title="Page Anchor & Linking" badge="Deep Link">
          <div>
            <StudioInput
              id={anchorIdInputId}
              label="HTML Anchor ID (Section Target)"
              value={styles.anchorId}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  anchorId: val.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                })
              }
              placeholder="e.g. rally-info, volunteer-form"
              description="Allows links like #rally-info to jump directly to this block."
            />
            {/* Quick-fill anchor chips */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Quick Anchors:</span>
              {COMMON_ANCHOR_TARGETS.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() =>
                    setStyles((prev) => ({
                      ...prev,
                      anchorId: target,
                    }))
                  }
                  className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                    styles.anchorId === target
                      ? 'bg-amber-500/20 text-accent-gold border-amber-500/40'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                  }`}
                >
                  #{target}
                </button>
              ))}
            </div>
          </div>
        </StudioSection>
      )}

      {/* 2. Device Visibility Matrix & Live Simulator */}
      <StudioSection title="Responsive Device Visibility" badge="Matrix">
        <div className="space-y-3">
          {/* Live Device Simulator Card */}
          <div
            data-testid="motion-advanced-preview-card"
            className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-3 shadow-inner"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Live Viewport Visibility Simulator
              </span>
              <span className="text-[10px] text-slate-400">Target Simulation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {devices.map((device) => {
                const Icon = device.icon;
                return (
                  <button
                    key={device.key}
                    type="button"
                    data-testid={`device-simulator-${device.key}`}
                    onClick={() =>
                      setStyles((prev) => ({
                        ...prev,
                        responsive: {
                          ...prev.responsive,
                          [device.key]: !prev.responsive[device.key],
                        },
                      }))
                    }
                    className={`p-2 rounded-md border text-center transition-all ${
                      device.hidden
                        ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                        : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mx-auto mb-1 ${
                        device.hidden ? 'text-rose-400 opacity-60' : 'text-emerald-400'
                      }`}
                    />
                    <span className="block text-[10px] font-medium text-foreground truncate">
                      {device.label}
                    </span>
                    <span
                      className={`inline-block text-[9px] font-semibold px-1 py-0.2 rounded mt-1 ${
                        device.hidden
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {device.hidden ? 'Hidden' : 'Visible'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Click Responsive Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                1-Click Visibility Presets
              </span>
              <span className="text-[10px] text-slate-400">Target Scopes</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {RESPONSIVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`responsive-preset-${preset.id}`}
                  onClick={() =>
                    setStyles((prev) => ({
                      ...prev,
                      responsive: {
                        ...prev.responsive,
                        ...preset.apply(),
                      },
                    }))
                  }
                  className="group p-2 rounded-md border border-border/40 bg-card/40 hover:bg-card hover:border-amber-500/40 text-left transition-all"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-foreground group-hover:text-accent-gold transition-colors">
                      {preset.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Granular Toggles */}
          <div>
            <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Granular Toggles
            </span>
            <div className="space-y-1.5">
              {[
                {
                  key: 'hideMobile' as const,
                  label: 'Hide on Mobile (<640px)',
                  active: styles.responsive.hideMobile,
                },
                {
                  key: 'hideTablet' as const,
                  label: 'Hide on Tablet (640-768px)',
                  active: styles.responsive.hideTablet,
                },
                {
                  key: 'hideDesktop' as const,
                  label: 'Hide on Desktop (>768px)',
                  active: styles.responsive.hideDesktop,
                },
                {
                  key: 'hidePrint' as const,
                  label: 'Hide on Print / Paper Export',
                  active: styles.responsive.hidePrint,
                },
              ].map((item) => (
                <StudioToggle
                  key={item.key}
                  label={item.label}
                  active={item.active}
                  activeTone="rose"
                  onToggle={() =>
                    setStyles({
                      ...styles,
                      responsive: {
                        ...styles.responsive,
                        [item.key]: !styles.responsive[item.key],
                      },
                    })
                  }
                  icon={
                    item.active ? (
                      <EyeOff size={13} className="text-rose-300" />
                    ) : (
                      <Eye size={13} className="text-slate-400" />
                    )
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </StudioSection>

      {/* 3. Generated CSS Classes Preview */}
      {compiledClassNames !== undefined && (
        <StudioSection title="Generated CSS Class Output" badge="Classes">
          <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Compiled Classnames Preview
            </span>
            <p className="font-mono text-[10px] text-accent-gold break-all">
              {compiledClassNames || '(default block styles)'}
            </p>
          </div>
        </StudioSection>
      )}
    </div>
  );
}
