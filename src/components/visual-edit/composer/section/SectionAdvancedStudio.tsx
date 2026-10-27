'use client';

import { Anchor, Eye, EyeOff, Monitor, Pin, Printer, Smartphone, Tablet } from 'lucide-react';
import type { VisualComposerSectionVisibilityPreset, VisualComposerStyles } from '@/types/unified';
import { StudioInput, StudioSection, StudioToggle } from '../ui';

export const SECTION_VISIBILITY_PRESETS: readonly VisualComposerSectionVisibilityPreset[] = [
  {
    id: 'universal-all',
    name: 'Universal (All Devices)',
    description: 'Visible on mobile, tablet, desktop, and paper print; unpinned standard flow',
    badge: 'Universal',
    apply: () => ({
      responsive: {
        hideMobile: false,
        hideTablet: false,
        hideDesktop: false,
        hidePrint: false,
      },
      sticky: false,
    }),
  },
  {
    id: 'sticky-header-banner',
    name: 'Sticky Header Banner',
    description: 'Pinned to top of screen on scroll, hidden when printing paper or PDF documents',
    badge: 'Sticky Pin',
    apply: () => ({
      responsive: {
        hideMobile: false,
        hideTablet: false,
        hideDesktop: false,
        hidePrint: true,
      },
      sticky: true,
    }),
  },
  {
    id: 'desktop-showcase-only',
    name: 'Desktop Showcase Only',
    description: 'Exclusive to tablet and desktop monitors; hidden on mobile viewports (<640px)',
    badge: 'Desktop Only',
    apply: () => ({
      responsive: {
        hideMobile: true,
        hideTablet: false,
        hideDesktop: false,
        hidePrint: false,
      },
      sticky: false,
    }),
  },
  {
    id: 'mobile-app-bar',
    name: 'Mobile App Bar (Pinned)',
    description: 'Mobile phone exclusive (<640px) pinned sticky bar for fast community action',
    badge: 'Mobile Sticky',
    apply: () => ({
      responsive: {
        hideMobile: false,
        hideTablet: true,
        hideDesktop: true,
        hidePrint: true,
      },
      sticky: true,
    }),
  },
] as const;

export const SECTION_ANCHOR_TARGETS = [
  'mission',
  'rallies',
  'newsletter',
  'volunteer',
  'donate',
  'contact',
  'partners',
  'faqs',
] as const;

export interface SectionAdvancedStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  sectionAnchorIdInputId?: string;
  sectionCustomClassesInputId?: string;
  sectionCustomStyleInputId?: string;
  compiledClassNames?: string;
}

export function SectionAdvancedStudio({
  styles,
  setStyles,
  sectionAnchorIdInputId,
  sectionCustomClassesInputId,
  sectionCustomStyleInputId = 'section-custom-style-input',
  compiledClassNames,
}: SectionAdvancedStudioProps) {
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
    <StudioSection
      title="Developer Attributes & Visibility"
      badge="Advanced"
      description="HTML anchor IDs, extra custom Tailwind classes, and device display controls."
    >
      <div className="space-y-4">
        {/* Live Section Developer Matrix & Simulator */}
        <div
          data-testid="section-advanced-preview-card"
          className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-3 shadow-inner"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Live Section Device Simulator
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
                  data-testid={`section-device-sim-${device.key}`}
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

          {/* Active Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {styles.section.sticky && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-accent-gold">
                <Pin className="w-2.5 h-2.5" />
                Sticky Pin Active
              </span>
            )}
            {styles.anchorId && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                <Anchor className="w-2.5 h-2.5 text-blue-400" />#{styles.anchorId}
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Section Visibility Presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              1-Click Visibility Presets
            </span>
            <span className="text-[10px] text-slate-400">Device Scopes</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SECTION_VISIBILITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`section-vis-preset-${preset.id}`}
                onClick={() => {
                  const updates = preset.apply();
                  setStyles((prev) => ({
                    ...prev,
                    responsive: {
                      ...prev.responsive,
                      ...updates.responsive,
                    },
                    section: {
                      ...prev.section,
                      ...(updates.sticky !== undefined ? { sticky: updates.sticky } : {}),
                    },
                  }));
                }}
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

        {/* Anchor ID and Custom Classes Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <StudioInput
              id={sectionAnchorIdInputId}
              label="Section Anchor ID"
              prefix="#"
              value={styles.anchorId}
              onChange={(val) =>
                setStyles({
                  ...styles,
                  anchorId: val.replace(/[^a-zA-Z0-9_-]/g, ''),
                })
              }
              placeholder="speakers, rsvp"
            />
            {/* Quick-fill anchor chips */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {SECTION_ANCHOR_TARGETS.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() =>
                    setStyles((prev) => ({
                      ...prev,
                      anchorId: target,
                    }))
                  }
                  className={`text-[9px] px-1.5 py-0.2 rounded border transition-colors ${
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
          <StudioInput
            id={sectionCustomClassesInputId}
            label="Section Custom Classes"
            value={styles.customClasses}
            onChange={(val) => setStyles({ ...styles, customClasses: val })}
            placeholder="border-t border-white/10"
          />
        </div>

        <div>
          <label
            htmlFor={sectionCustomStyleInputId}
            className="block text-slate-300 font-bold mb-1"
          >
            Section Custom Inline CSS (style=&quot;...&quot;)
          </label>
          <input
            id={sectionCustomStyleInputId}
            type="text"
            value={styles.customStyle || ''}
            onChange={(e) => setStyles({ ...styles, customStyle: e.target.value })}
            placeholder="e.g. min-height: 480px; background-attachment: fixed;"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Custom inline CSS rules applied directly to the outer row / section container.
          </p>
        </div>

        {/* Sticky Row Pinning & Print Visibility */}
        <div className="grid grid-cols-2 gap-2">
          <StudioToggle
            label="Sticky Row"
            description="Pin to top on scroll"
            active={Boolean(styles.section.sticky)}
            statusLabel={styles.section.sticky ? 'ON' : 'OFF'}
            onToggle={() =>
              setStyles({
                ...styles,
                section: { ...styles.section, sticky: !styles.section.sticky },
              })
            }
          />
          <StudioToggle
            label="Hide on Print"
            description="Exclude from print"
            active={Boolean(styles.responsive.hidePrint)}
            activeTone="rose"
            statusLabel={styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
            onToggle={() =>
              setStyles({
                ...styles,
                responsive: {
                  ...styles.responsive,
                  hidePrint: !styles.responsive.hidePrint,
                },
              })
            }
          />
        </div>

        {/* Section Responsive Device Visibility Toggles */}
        <div>
          <span className="block text-slate-400 text-[10px] mb-1.5 font-medium">
            Hide on Devices (Granular)
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              {
                key: 'hideMobile' as const,
                label: 'Mobile',
                active: styles.responsive.hideMobile,
              },
              {
                key: 'hideTablet' as const,
                label: 'Tablet',
                active: styles.responsive.hideTablet,
              },
              {
                key: 'hideDesktop' as const,
                label: 'Desktop',
                active: styles.responsive.hideDesktop,
              },
            ].map((item) => (
              <StudioToggle
                key={item.key}
                label={item.label}
                active={Boolean(item.active)}
                activeTone="rose"
                icon={
                  item.active ? (
                    <EyeOff size={12} className="text-rose-300" />
                  ) : (
                    <Eye size={12} className="text-slate-400" />
                  )
                }
                onToggle={() =>
                  setStyles({
                    ...styles,
                    responsive: {
                      ...styles.responsive,
                      [item.key]: !styles.responsive[item.key],
                    },
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* Generated CSS Classes Preview */}
        {compiledClassNames !== undefined && (
          <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Compiled Classnames Preview
            </span>
            <p className="font-mono text-[10px] text-accent-gold break-all">
              {compiledClassNames || '(default section styles)'}
            </p>
          </div>
        )}
      </div>
    </StudioSection>
  );
}
