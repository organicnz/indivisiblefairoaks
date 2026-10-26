'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Box,
  ClipboardCopy,
  ClipboardPaste,
  Code,
  Columns3,
  Eye,
  EyeOff,
  Layers,
  LayoutTemplate,
  Link2,
  Move,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Type,
  Unlink2,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import type { Block, HeadingLevel } from '@/lib/blocks';

export interface VisualComposerStyles {
  margin: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  padding: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  section: {
    containerWidth: string;
    paddingY: string;
    paddingX: string;
    minHeight: string;
    background: string;
    bgGradient: string;
    pattern: string;
    divider: string;
    columns: string;
    columnGap: string;
    verticalAlign: string;
    reverseMobile: boolean;
    radius: string;
    shadow: string;
    sticky: boolean;
  };
  typography: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    lineHeight: string;
    letterSpacing: string;
    textTransform: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
    color: string;
    textGradient: string;
    textShadow: string;
  };
  border: {
    side: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'y';
    width: string;
    style: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
    color: string;
    radius: string;
  };
  background: {
    preset: string;
    blur: boolean;
    gradient: string;
  };
  shadow: string;
  layout: {
    display: string;
    flexDirection: string;
    justifyContent: string;
    alignItems: string;
    columns: string;
    maxWidth: string;
    position: string;
    zIndex: string;
    overflow: string;
  };
  effects: {
    opacity: string;
    backdropBlur: string;
    grayscale: string;
    brightness?: string;
    contrast?: string;
    saturate?: string;
    sepia?: string;
    hueRotate?: string;
    blur?: string;
  };
  motion: {
    entrance: string;
    hover: string;
    hoverScale?: string;
    hoverLift?: string;
    hoverRotate?: string;
    duration?: string;
    delay?: string;
  };
  transform?: {
    rotate?: string;
    scale?: string;
    skew?: string;
  };
  anchorId: string;
  responsive: {
    hideMobile: boolean;
    hideTablet: boolean;
    hideDesktop: boolean;
    hidePrint: boolean;
  };
  animation: string;
  customClasses: string;
}

export const DEFAULT_VC_STYLES: VisualComposerStyles = {
  margin: { top: 'my-2', bottom: '', left: '', right: '' },
  padding: { top: 'p-4', bottom: '', left: '', right: '' },
  section: {
    containerWidth: 'max-w-4xl mx-auto px-4',
    paddingY: 'py-8',
    paddingX: 'px-4',
    minHeight: '',
    background: 'bg-transparent',
    divider: '',
    columns: '',
    columnGap: 'gap-8',
    verticalAlign: 'items-start',
    reverseMobile: false,
    bgGradient: '',
    pattern: '',
    radius: 'rounded-none',
    shadow: 'shadow-none',
    sticky: false,
  },
  typography: {
    fontFamily: '',
    fontSize: 'text-base',
    fontWeight: 'font-normal',
    textAlign: 'left',
    lineHeight: 'leading-relaxed',
    letterSpacing: 'tracking-normal',
    textTransform: 'none',
    color: 'text-foreground',
    textGradient: '',
    textShadow: '',
  },
  border: {
    side: 'all',
    width: 'border-0',
    style: 'none',
    color: 'border-border',
    radius: 'rounded-xl',
  },
  background: {
    preset: 'bg-transparent',
    blur: false,
    gradient: '',
  },
  shadow: 'shadow-none',
  layout: {
    display: '',
    flexDirection: '',
    justifyContent: '',
    alignItems: '',
    columns: '',
    maxWidth: '',
    position: '',
    zIndex: '',
    overflow: '',
  },
  effects: {
    opacity: '',
    backdropBlur: '',
    grayscale: '',
    brightness: '',
    contrast: '',
    saturate: '',
    sepia: '',
    hueRotate: '',
    blur: '',
  },
  motion: {
    entrance: '',
    hover: '',
    hoverScale: '',
    hoverLift: '',
    hoverRotate: '',
    duration: '',
    delay: '',
  },
  transform: {
    rotate: '',
    scale: '',
    skew: '',
  },
  anchorId: '',
  responsive: {
    hideMobile: false,
    hideTablet: false,
    hideDesktop: false,
    hidePrint: false,
  },
  animation: 'none',
  customClasses: '',
};

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  apply: () => Partial<VisualComposerStyles>;
}

export const VC_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'editorial-card',
    name: 'Editorial Card',
    description: 'Clean surface card with subtle shadow and rounded corners',
    badge: 'Card',
    apply: () => ({
      margin: { top: 'my-4', bottom: '', left: '', right: '' },
      padding: { top: 'p-6', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border',
        style: 'solid',
        color: 'border-border',
        radius: 'rounded-2xl',
      },
      background: { preset: 'bg-slate-900/60', blur: false, gradient: '' },
      shadow: 'shadow-md',
      typography: {
        fontFamily: '',
        fontSize: 'text-base',
        fontWeight: 'font-normal',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-foreground',
        textGradient: '',
        textShadow: '',
      },
      motion: {
        entrance: 'animate-in fade-in duration-300',
        hover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-200',
      },
    }),
  },
  {
    id: 'civic-callout',
    name: 'Civic Gold Callout',
    description: 'Gold accent highlight with warm border and civic tone',
    badge: 'Civic',
    apply: () => ({
      margin: { top: 'my-4', bottom: '', left: '', right: '' },
      padding: { top: 'p-5', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border-2',
        style: 'solid',
        color: 'border-amber-500/50',
        radius: 'rounded-2xl',
      },
      background: { preset: 'bg-amber-500/10', blur: false, gradient: '' },
      shadow: 'shadow-sm',
      typography: {
        fontFamily: '',
        fontSize: 'text-base',
        fontWeight: 'font-medium',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-amber-600 dark:text-amber-400',
        textGradient: '',
        textShadow: '',
      },
      motion: {
        entrance: 'animate-in fade-in slide-in-from-bottom-4 duration-300',
        hover: 'hover:ring-2 hover:ring-amber-500/60 transition-all duration-200',
      },
    }),
  },
  {
    id: 'patriotic-hero',
    name: 'Patriotic Navy Hero',
    description: 'Deep navy background with high-contrast text and maximum depth',
    badge: 'Hero',
    apply: () => ({
      margin: { top: 'my-6', bottom: '', left: '', right: '' },
      padding: { top: 'p-8', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border',
        style: 'solid',
        color: 'border-blue-900/50',
        radius: 'rounded-3xl',
      },
      background: { preset: 'bg-slate-950/90', blur: false, gradient: '' },
      shadow: 'shadow-2xl',
      typography: {
        fontFamily: '',
        fontSize: 'text-xl',
        fontWeight: 'font-bold',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-tight',
        textTransform: 'none',
        color: 'text-white',
        textGradient: '',
        textShadow: 'drop-shadow-md',
      },
      motion: {
        entrance: 'animate-in fade-in zoom-in-95 duration-200',
        hover: 'hover:scale-[1.02] transition-transform duration-200',
      },
    }),
  },
  {
    id: 'glass-surface',
    name: 'Frost Glass Surface',
    description: 'Liquid glassmorphism backdrop with subtle translucent border',
    badge: 'Glass',
    apply: () => ({
      margin: { top: 'my-4', bottom: '', left: '', right: '' },
      padding: { top: 'p-6', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border',
        style: 'solid',
        color: 'border-white/30',
        radius: 'rounded-2xl',
      },
      background: { preset: 'bg-white/10', blur: true, gradient: '' },
      shadow: 'shadow-xl',
      typography: {
        fontFamily: '',
        fontSize: 'text-base',
        fontWeight: 'font-normal',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-white',
        textGradient: '',
        textShadow: '',
      },
      motion: {
        entrance: 'animate-in fade-in duration-300',
        hover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-200',
      },
    }),
  },
  {
    id: 'urgent-alert',
    name: 'Urgent Action Alert',
    description: 'High-urgency crimson styling for deadlines and critical rallies',
    badge: 'Alert',
    apply: () => ({
      margin: { top: 'my-4', bottom: '', left: '', right: '' },
      padding: { top: 'p-5', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border-2',
        style: 'solid',
        color: 'border-rose-500/50',
        radius: 'rounded-xl',
      },
      background: { preset: 'bg-rose-500/10', blur: false, gradient: '' },
      shadow: 'shadow-md',
      typography: {
        fontFamily: '',
        fontSize: 'text-base',
        fontWeight: 'font-semibold',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-rose-600 dark:text-rose-400',
        textGradient: '',
        textShadow: '',
      },
      motion: { entrance: 'animate-pulse duration-700', hover: '' },
    }),
  },
  {
    id: 'grassroots-emerald',
    name: 'Grassroots Forest Green',
    description: 'Community ecology green tint with subtle organic borders',
    badge: 'Community',
    apply: () => ({
      margin: { top: 'my-4', bottom: '', left: '', right: '' },
      padding: { top: 'p-6', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border',
        style: 'solid',
        color: 'border-emerald-500/40',
        radius: 'rounded-2xl',
      },
      background: { preset: 'bg-emerald-500/10', blur: false, gradient: '' },
      shadow: 'shadow-md',
      typography: {
        fontFamily: '',
        fontSize: 'text-base',
        fontWeight: 'font-medium',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-emerald-700 dark:text-emerald-400',
        textGradient: '',
        textShadow: '',
      },
      motion: { entrance: 'animate-in fade-in duration-300', hover: 'hover:scale-[1.01]' },
    }),
  },
  {
    id: 'minimal-bordered',
    name: 'Minimal Clean Border',
    description: 'Crisp hairline border with standard body typography',
    badge: 'Clean',
    apply: () => ({
      margin: { top: 'my-2', bottom: '', left: '', right: '' },
      padding: { top: 'p-4', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border',
        style: 'solid',
        color: 'border-border',
        radius: 'rounded-xl',
      },
      background: { preset: 'bg-transparent', blur: false, gradient: '' },
      shadow: 'shadow-none',
      typography: {
        fontFamily: '',
        fontSize: 'text-base',
        fontWeight: 'font-normal',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-foreground',
        textGradient: '',
        textShadow: '',
      },
      motion: { entrance: '', hover: '' },
    }),
  },
  {
    id: 'left-accent-quote',
    name: 'Left Accent Quote Bar',
    description: 'Prominent 4px civic gold left accent bar with editorial serif',
    badge: 'Editorial',
    apply: () => ({
      margin: { top: 'my-6', bottom: '', left: '', right: '' },
      padding: { top: 'py-4', bottom: '', left: 'pl-6', right: 'pr-4' },
      border: {
        side: 'left',
        width: 'border-4',
        style: 'solid',
        color: 'border-amber-500',
        radius: 'rounded-none',
      },
      background: { preset: 'bg-slate-900/40', blur: false, gradient: '' },
      shadow: 'shadow-sm',
      typography: {
        fontFamily: 'font-serif',
        fontSize: 'text-lg',
        fontWeight: 'font-medium',
        textAlign: 'left',
        lineHeight: 'leading-relaxed',
        letterSpacing: 'tracking-normal',
        textTransform: 'none',
        color: 'text-foreground',
        textGradient: '',
        textShadow: '',
      },
      motion: { entrance: 'animate-in fade-in duration-300', hover: '' },
    }),
  },
  {
    id: 'golden-hero-badge',
    name: 'Golden Hero Badge',
    description: 'Shimmering metallic gold headline gradient with dark midnight card',
    badge: 'Badge',
    apply: () => ({
      margin: { top: 'my-6', bottom: '', left: '', right: '' },
      padding: { top: 'p-8', bottom: '', left: '', right: '' },
      border: {
        side: 'all',
        width: 'border-2',
        style: 'solid',
        color: 'border-amber-500/60',
        radius: 'rounded-3xl',
      },
      background: { preset: 'bg-slate-950/95', blur: false, gradient: '' },
      shadow: 'shadow-2xl shadow-amber-500/10',
      typography: {
        fontFamily: '',
        fontSize: 'text-2xl',
        fontWeight: 'font-bold',
        textAlign: 'center',
        lineHeight: 'leading-tight',
        letterSpacing: 'tracking-tight',
        textTransform: 'none',
        color: 'text-foreground',
        textGradient:
          'bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent',
        textShadow: 'drop-shadow-md',
      },
      motion: {
        entrance: 'animate-in fade-in zoom-in-95 duration-200',
        hover: 'hover:scale-[1.02] transition-transform duration-200',
      },
    }),
  },
  {
    id: 'compact-pill-action',
    name: 'Compact Pill Action',
    description: 'Fully rounded pill container with interactive hover float',
    badge: 'Pill',
    apply: () => ({
      margin: { top: 'my-3', bottom: '', left: '', right: '' },
      padding: { top: 'py-3', bottom: '', left: 'px-6', right: '' },
      border: {
        side: 'all',
        width: 'border',
        style: 'solid',
        color: 'border-border',
        radius: 'rounded-full',
      },
      background: { preset: 'bg-card text-foreground', blur: false, gradient: '' },
      shadow: 'shadow-md',
      typography: {
        fontFamily: '',
        fontSize: 'text-sm',
        fontWeight: 'font-bold',
        textAlign: 'center',
        lineHeight: 'leading-normal',
        letterSpacing: 'tracking-wide',
        textTransform: 'none',
        color: 'text-foreground',
        textGradient: '',
        textShadow: '',
      },
      motion: {
        entrance: 'animate-in fade-in duration-200',
        hover: 'hover:-translate-y-1 hover:shadow-lg transition-all duration-200',
      },
    }),
  },
];

export const VC_COLUMN_PRESETS = [
  { id: '1-col', label: '1/1', value: '', cols: [{ id: 'c1', width: '100%' }] },
  {
    id: '2-col',
    label: '1/2 + 1/2',
    value: 'grid grid-cols-1 md:grid-cols-2',
    cols: [
      { id: 'c1', width: '50%' },
      { id: 'c2', width: '50%' },
    ],
  },
  {
    id: '3-col',
    label: '1/3 × 3',
    value: 'grid grid-cols-1 md:grid-cols-3',
    cols: [
      { id: 'c1', width: '33%' },
      { id: 'c2', width: '33%' },
      { id: 'c3', width: '33%' },
    ],
  },
  {
    id: '4-col',
    label: '1/4 × 4',
    value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    cols: [
      { id: 'c1', width: '25%' },
      { id: 'c2', width: '25%' },
      { id: 'c3', width: '25%' },
      { id: 'c4', width: '25%' },
    ],
  },
  {
    id: '2-1-col',
    label: '2/3 + 1/3',
    value: 'grid grid-cols-1 md:grid-cols-3 [&>*:first-child]:md:col-span-2',
    cols: [
      { id: 'c1', width: '66%' },
      { id: 'c2', width: '33%' },
    ],
  },
  {
    id: '1-2-col',
    label: '1/3 + 2/3',
    value: 'grid grid-cols-1 md:grid-cols-3 [&>*:last-child]:md:col-span-2',
    cols: [
      { id: 'c1', width: '33%' },
      { id: 'c2', width: '66%' },
    ],
  },
  {
    id: '1-2-1-col',
    label: '1/4 + 1/2 + 1/4',
    value: 'grid grid-cols-1 md:grid-cols-4 [&>*:nth-child(2)]:md:col-span-2',
    cols: [
      { id: 'c1', width: '25%' },
      { id: 'c2', width: '50%' },
      { id: 'c3', width: '25%' },
    ],
  },
] as const;

export const CIVIC_CLASS_PRESETS = [
  { label: 'Glass Frost', value: 'backdrop-blur-md bg-white/10 border border-white/20 text-white' },
  { label: 'Amber Glow', value: 'shadow-lg shadow-amber-500/20 ring-1 ring-amber-500/50' },
  { label: 'Gold Border', value: 'border border-accent-gold/40' },
  { label: 'Tilt 3D', value: 'rotate-1 hover:rotate-0 transition-transform duration-200' },
  { label: 'Card Lift', value: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-200' },
  { label: 'Subtle Pulse', value: 'animate-pulse duration-1000' },
] as const;

// Module-level clipboard for copying & pasting styles across blocks
let stylesClipboard: VisualComposerStyles | null = null;

export function getStylesClipboard(): VisualComposerStyles | null {
  return stylesClipboard;
}

export function setStylesClipboard(styles: VisualComposerStyles): void {
  stylesClipboard = { ...styles };
}

interface VisualComposerInspectorProps {
  open: boolean;
  onClose: () => void;
  block: Block | null;
  blockIndex: number | null;
  onSaveBlock: (updatedBlock: Block, customClasses?: string, anchorId?: string) => void;
  initialMode?: 'block' | 'section';
}

export function VisualComposerInspector({
  open,
  onClose,
  block,
  blockIndex,
  onSaveBlock,
  initialMode = 'block',
}: VisualComposerInspectorProps) {
  const [inspectorMode, setInspectorMode] = useState<'block' | 'section'>(initialMode);
  const [activeTab, setActiveTab] = useState<
    'content' | 'presets' | 'design' | 'typography' | 'code' | 'advanced'
  >('content');
  const [styles, setStyles] = useState<VisualComposerStyles>(DEFAULT_VC_STYLES);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(block);
  const [hasCopiedStyles, setHasCopiedStyles] = useState<boolean>(Boolean(stylesClipboard));
  const [isSidesLinked, setIsSidesLinked] = useState<boolean>(true);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const titleId = useId();
  const descId = useId();

  // Control IDs for accessibility
  const headingTextId = useId();
  const paragraphTextId = useId();
  const imageSrcId = useId();
  const imageAltId = useId();
  const imageCaptionId = useId();
  const buttonLabelId = useId();
  const buttonHrefId = useId();
  const calloutTextId = useId();
  const quoteTextId = useId();
  const listItemsId = useId();
  const codeTextId = useId();
  const tableHeadId = useId();
  const tableRowsId = useId();
  const unsupportedHtmlId = useId();
  const transformRotateSelectId = useId();
  const transformScaleSelectId = useId();
  const transformSkewSelectId = useId();

  const marginSelectId = useId();
  const paddingSelectId = useId();
  const radiusSelectId = useId();
  const borderWidthSelectId = useId();
  const borderStyleSelectId = useId();
  const borderSideSelectId = useId();
  const bgThemeSelectId = useId();
  const bgGradientSelectId = useId();
  const shadowSelectId = useId();
  const layoutColumnsSelectId = useId();
  const layoutMaxWidthSelectId = useId();

  const sectionWidthSelectId = useId();
  const sectionPaddingYSelectId = useId();
  const sectionPaddingXSelectId = useId();
  const sectionMinHeightSelectId = useId();
  const sectionPatternSelectId = useId();
  const sectionBgSelectId = useId();
  const sectionDividerSelectId = useId();
  const sectionColumnsSelectId = useId();
  const sectionGapSelectId = useId();
  const sectionAlignSelectId = useId();
  const sectionRadiusSelectId = useId();
  const sectionShadowSelectId = useId();
  const sectionAnchorIdInputId = useId();
  const sectionCustomClassesInputId = useId();
  const sectionBackdropBlurSelectId = useId();

  const layoutDisplaySelectId = useId();
  const layoutFlexDirSelectId = useId();
  const layoutJustifySelectId = useId();
  const layoutAlignSelectId = useId();
  const layoutPositionSelectId = useId();
  const layoutZIndexSelectId = useId();
  const layoutOverflowSelectId = useId();

  const effectOpacitySelectId = useId();
  const effectBackdropBlurSelectId = useId();
  const effectGrayscaleSelectId = useId();
  const effectBrightnessSelectId = useId();
  const effectContrastSelectId = useId();
  const effectSaturateSelectId = useId();
  const effectSepiaSelectId = useId();
  const effectHueRotateSelectId = useId();
  const effectBlurSelectId = useId();

  const fontFamilySelectId = useId();
  const fontSizeSelectId = useId();
  const fontWeightSelectId = useId();
  const lineHeightSelectId = useId();
  const textGradientSelectId = useId();
  const textShadowSelectId = useId();
  const letterSpacingSelectId = useId();
  const textTransformSelectId = useId();
  const motionEntranceSelectId = useId();
  const motionHoverSelectId = useId();
  const motionHoverScaleSelectId = useId();
  const motionHoverLiftSelectId = useId();
  const motionHoverRotateSelectId = useId();
  const motionDurationSelectId = useId();
  const motionDelaySelectId = useId();
  const anchorIdInputId = useId();
  const customClassesInputId = useId();
  const rawHtmlInputId = useId();

  // Sync block state when props change
  useEffect(() => {
    setCurrentBlock(block);
    if (block && 'html' in block && typeof block.html === 'string') {
      const trimmed = block.html.trim();
      const divMatch = trimmed.match(/^<div\s+([^>]*?)>/i);
      if (divMatch) {
        const attrs = divMatch[1] || '';
        const idMatch = attrs.match(/id=["']([^"']+)["']/i);
        const classMatch = attrs.match(/class=["']([^"']+)["']/i);
        if (idMatch?.[1]) {
          setStyles((prev) => ({ ...prev, anchorId: idMatch[1] }));
        }
        if (classMatch?.[1]) {
          setStyles((prev) => ({
            ...prev,
            customClasses: prev.customClasses || classMatch[1],
          }));
        }
      }
    }
  }, [block]);

  // Sync mode if initialMode prop updates
  useEffect(() => {
    setInspectorMode(initialMode);
  }, [initialMode]);

  if (!open || !currentBlock || blockIndex === null) return null;

  // Build border utility string based on side and width
  const compiledBorderClasses = (() => {
    if (styles.border.width === 'border-0') return '';
    const sidePrefix =
      styles.border.side === 'top'
        ? styles.border.width.replace('border', 'border-t')
        : styles.border.side === 'bottom'
          ? styles.border.width.replace('border', 'border-b')
          : styles.border.side === 'left'
            ? styles.border.width.replace('border', 'border-l')
            : styles.border.side === 'right'
              ? styles.border.width.replace('border', 'border-r')
              : styles.border.side === 'y'
                ? styles.border.width.replace('border', 'border-y')
                : styles.border.width;
    const styleClass = styles.border.style !== 'none' ? `border-${styles.border.style}` : '';
    return [sidePrefix, styleClass, styles.border.color, styles.border.radius]
      .filter(Boolean)
      .join(' ');
  })();

  // Build Tailwind classes string based on mode
  const compiledClassNames = (
    inspectorMode === 'section'
      ? [
          styles.section.containerWidth,
          styles.section.paddingY,
          styles.section.paddingX !== 'px-4' ? styles.section.paddingX : '',
          styles.section.minHeight,
          styles.section.pattern || styles.section.bgGradient || styles.section.background,
          styles.effects.backdropBlur,
          styles.section.divider,
          styles.section.columns,
          styles.section.columns ? styles.section.columnGap : '',
          styles.section.columns ? styles.section.verticalAlign : '',
          styles.section.reverseMobile ? 'flex flex-col-reverse md:flex-row' : '',
          styles.section.radius !== 'rounded-none' ? styles.section.radius : '',
          styles.section.shadow !== 'shadow-none' ? styles.section.shadow : '',
          styles.section.sticky ? 'sticky top-0 z-40 backdrop-blur-md' : '',
          styles.motion.entrance,
          styles.motion.hover,
          styles.responsive.hideMobile ? 'max-sm:hidden' : '',
          styles.responsive.hideTablet ? 'sm:max-md:hidden' : '',
          styles.responsive.hideDesktop ? 'md:hidden' : '',
          styles.responsive.hidePrint ? 'print:hidden' : '',
          styles.customClasses,
        ]
      : [
          styles.layout.display,
          styles.layout.display === 'flex' || styles.layout.display === 'inline-flex'
            ? [styles.layout.flexDirection, styles.layout.justifyContent, styles.layout.alignItems]
                .filter(Boolean)
                .join(' ')
            : '',
          styles.layout.position,
          styles.layout.zIndex,
          styles.layout.overflow,
          styles.layout.maxWidth,
          styles.layout.columns,
          styles.margin.top,
          styles.margin.bottom,
          styles.margin.left,
          styles.margin.right,
          styles.padding.top,
          styles.padding.bottom,
          styles.padding.left,
          styles.padding.right,
          styles.typography.fontFamily,
          styles.typography.textGradient || styles.typography.color,
          styles.typography.fontSize,
          styles.typography.fontWeight,
          styles.typography.textAlign === 'center'
            ? 'text-center'
            : styles.typography.textAlign === 'right'
              ? 'text-right'
              : styles.typography.textAlign === 'justify'
                ? 'text-justify'
                : 'text-left',
          styles.typography.lineHeight,
          styles.typography.letterSpacing,
          styles.typography.textTransform !== 'none' ? styles.typography.textTransform : '',
          styles.typography.textShadow,
          compiledBorderClasses,
          styles.background.gradient || styles.background.preset,
          styles.effects.backdropBlur || (styles.background.blur ? 'backdrop-blur-md' : ''),
          styles.effects.opacity,
          styles.effects.grayscale,
          styles.effects.brightness,
          styles.effects.contrast,
          styles.effects.saturate,
          styles.effects.sepia,
          styles.effects.hueRotate,
          styles.effects.blur,
          styles.shadow !== 'shadow-none' ? styles.shadow : '',
          styles.transform?.rotate,
          styles.transform?.scale,
          styles.transform?.skew,
          styles.motion.entrance,
          styles.motion.delay,
          styles.motion.hover,
          styles.motion.hoverScale,
          styles.motion.hoverLift,
          styles.motion.hoverRotate,
          styles.motion.duration,
          styles.responsive.hideMobile ? 'max-sm:hidden' : '',
          styles.responsive.hideTablet ? 'sm:max-md:hidden' : '',
          styles.responsive.hideDesktop ? 'md:hidden' : '',
          styles.responsive.hidePrint ? 'print:hidden' : '',
          styles.animation !== 'none' ? styles.animation : '',
          styles.customClasses,
        ]
  )
    .filter(Boolean)
    .join(' ')
    .trim();

  const handleApply = () => {
    if (!currentBlock) return;
    onSaveBlock(currentBlock, compiledClassNames, styles.anchorId.trim() || undefined);
    onClose();
  };

  const handleApplyPreset = (preset: StylePreset) => {
    const applied = preset.apply();
    setStyles((prev) => ({
      ...prev,
      ...applied,
    }));
    toast.success(`Applied ${preset.name} preset`);
  };

  const handleCopyStyles = () => {
    stylesClipboard = { ...styles };
    setHasCopiedStyles(true);
    toast.success('Block styles copied to clipboard');
  };

  const handlePasteStyles = () => {
    if (!stylesClipboard) {
      toast.error('Clipboard is empty. Copy styles from a block first.');
      return;
    }
    setStyles({ ...stylesClipboard });
    toast.success('Styles pasted to active block');
  };

  // Helper to cycle margin values
  const cycleMarginValue = (
    current: string,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): string => {
    const sequence =
      axis === 'horizontal'
        ? ['', 'mx-2', 'mx-4', 'mx-6', 'mx-auto']
        : ['', 'my-2', 'my-4', 'my-6', 'my-8', 'my-12'];
    const idx = sequence.indexOf(current);
    return sequence[(idx + 1) % sequence.length] || '';
  };

  // Helper to cycle padding values
  const cyclePaddingValue = (
    current: string,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): string => {
    const sequence =
      axis === 'horizontal'
        ? ['', 'px-2', 'px-4', 'px-6', 'px-8', 'px-12']
        : ['', 'p-2', 'p-4', 'p-6', 'p-8', 'p-12'];
    const idx = sequence.indexOf(current);
    return sequence[(idx + 1) % sequence.length] || '';
  };

  return (
    <aside
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-y-0 right-0 z-[10010] flex w-full max-w-md flex-col border-l border-white/20 bg-slate-950/95 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right duration-200 pointer-events-auto"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gold/20 text-accent-gold">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold text-white tracking-wide">
              Visual Composer Inspector
            </h2>
            <p id={descId} className="text-[11px] text-slate-400 capitalize">
              Block #{blockIndex + 1} · {currentBlock.type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Copy Styles Button */}
          <button
            type="button"
            onClick={handleCopyStyles}
            title="Copy current styles to clipboard"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ClipboardCopy size={12} />
            <span>Copy</span>
          </button>

          {/* Quick Paste Styles Button */}
          <button
            type="button"
            onClick={handlePasteStyles}
            disabled={!hasCopiedStyles}
            title={hasCopiedStyles ? 'Paste copied styles' : 'Clipboard empty'}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
              hasCopiedStyles
                ? 'border-accent-gold/40 bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25'
                : 'border-white/5 bg-white/5 text-slate-400 opacity-40 cursor-not-allowed'
            }`}
          >
            <ClipboardPaste size={12} />
            <span>Paste</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Inspector"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors ml-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Target Level Mode Switcher: Block Element vs Row / Section */}
      <div className="flex border-b border-white/10 bg-slate-900/80 p-2 gap-1.5">
        <button
          type="button"
          onClick={() => setInspectorMode('block')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
            inspectorMode === 'block'
              ? 'bg-accent-gold text-ink-strong shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Box size={13} />
          <span>Block Element</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectorMode('section')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
            inspectorMode === 'section'
              ? 'bg-accent-gold text-ink-strong shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutTemplate size={13} />
          <span>Row / Section</span>
        </button>
      </div>

      {/* Tabs Navigation (Block Mode) */}
      {inspectorMode === 'block' && (
        <div className="flex border-b border-white/10 bg-slate-900/60 px-2 py-1.5 gap-1 text-[11px]">
          {[
            { id: 'content', label: 'Content', icon: Type },
            { id: 'presets', label: 'Presets', icon: Wand2 },
            { id: 'design', label: 'Box Model', icon: Move },
            { id: 'typography', label: 'Type', icon: Palette },
            { id: 'code', label: 'Code', icon: Code },
            { id: 'advanced', label: 'Advanced', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg font-bold transition-colors ${
                  isActive
                    ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Live Mini Preview Box with Responsive Viewport Device Switcher */}
      <div className="border-b border-white/10 bg-slate-900/40 px-5 py-2.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles size={11} className="text-accent-gold" />
            <span>Live Mini-Preview ({inspectorMode})</span>
            <span className="text-[9px] text-accent-gold/90 font-mono ml-1">Real-time</span>
          </span>
          <div className="flex items-center gap-1">
            {(['desktop', 'tablet', 'mobile'] as const).map((dev) => (
              <button
                key={dev}
                type="button"
                onClick={() => setPreviewDevice(dev)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize transition-colors ${
                  previewDevice === dev
                    ? 'bg-accent-gold text-ink-strong'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
                title={`Preview on ${dev}`}
                aria-label={`Preview on ${dev}`}
              >
                {dev === 'desktop' ? 'Desk' : dev === 'tablet' ? 'Tab' : 'Mob'}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 overflow-hidden transition-all duration-300">
          <div
            className={`transition-all duration-300 ${
              previewDevice === 'mobile'
                ? 'max-w-[220px] mx-auto'
                : previewDevice === 'tablet'
                  ? 'max-w-[320px] mx-auto'
                  : 'w-full'
            }`}
          >
            <div className={`${compiledClassNames || 'p-2 text-white text-xs'}`}>
              <p className="line-clamp-2 text-xs">
                {currentBlock.type === 'heading'
                  ? currentBlock.html || 'Heading Preview Text'
                  : currentBlock.type === 'paragraph'
                    ? currentBlock.html || 'Paragraph preview content goes here.'
                    : currentBlock.type === 'button'
                      ? currentBlock.label || 'Action Button'
                      : currentBlock.type === 'callout'
                        ? currentBlock.html || 'Callout message box'
                        : `${currentBlock.type} element`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content Panels */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* ── Section / Row Mode Settings ───────────────────────────────── */}
        {inspectorMode === 'section' && (
          <div className="space-y-4">
            <div>
              <span className="block text-slate-300 font-bold mb-2">Section Container Width</span>
              <label htmlFor={sectionWidthSelectId} className="sr-only">
                Container Width
              </label>
              <select
                id={sectionWidthSelectId}
                value={styles.section.containerWidth}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, containerWidth: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="max-w-4xl mx-auto px-4">Standard Editorial (4XL - 896px)</option>
                <option value="max-w-5xl mx-auto px-4">Wide Content (5XL - 1024px)</option>
                <option value="max-w-7xl mx-auto px-6">Ultra Wide Showcase (7XL - 1280px)</option>
                <option value="max-w-2xl mx-auto px-4">Compact Focused Reader (2XL - 672px)</option>
                <option value="w-full px-4">Full Bleed Fluid (100% Width)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-slate-300 font-bold mb-2">
                  Vertical Section Padding
                </span>
                <label htmlFor={sectionPaddingYSelectId} className="sr-only">
                  Vertical Padding
                </label>
                <select
                  id={sectionPaddingYSelectId}
                  value={styles.section.paddingY}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, paddingY: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
                >
                  <option value="py-8">Standard Breathing Room (py-8 / 32px)</option>
                  <option value="py-16">Generous Space (py-16 / 64px)</option>
                  <option value="py-24">Hero Spotlight (py-24 / 96px)</option>
                  <option value="py-4">Compact Spacing (py-4 / 16px)</option>
                  <option value="py-0">Flush Edge (py-0 / 0px)</option>
                </select>
              </div>
              <div>
                <span className="block text-slate-300 font-bold mb-2">Horizontal Padding</span>
                <label htmlFor={sectionPaddingXSelectId} className="sr-only">
                  Horizontal Padding
                </label>
                <select
                  id={sectionPaddingXSelectId}
                  value={styles.section.paddingX}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, paddingX: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
                >
                  <option value="px-4">Standard (px-4 / 16px)</option>
                  <option value="px-6">Spacious (px-6 / 24px)</option>
                  <option value="px-8">Generous (px-8 / 32px)</option>
                  <option value="px-12">Deep Inset (px-12 / 48px)</option>
                  <option value="px-0">Edge to Edge (px-0)</option>
                </select>
              </div>
            </div>

            {/* Section Min-Height & Viewport Sizing */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Section Viewport &amp; Min Height
              </span>
              <label htmlFor={sectionMinHeightSelectId} className="sr-only">
                Section Min Height
              </label>
              <select
                id={sectionMinHeightSelectId}
                value={styles.section.minHeight}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, minHeight: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="">Auto (Content Derived)</option>
                <option value="min-h-[250px] flex flex-col justify-center">
                  Compact Band (min-h-[250px])
                </option>
                <option value="min-h-[400px] flex flex-col justify-center">
                  Medium Section (min-h-[400px])
                </option>
                <option value="min-h-[50vh] flex flex-col justify-center">
                  Half Viewport (min-h-[50vh])
                </option>
                <option value="min-h-[75vh] flex flex-col justify-center">
                  Hero Prominence (min-h-[75vh])
                </option>
                <option value="min-h-screen flex flex-col justify-center">
                  Full Viewport Screen (min-h-screen)
                </option>
              </select>
            </div>

            <div>
              <span className="block text-slate-300 font-bold mb-2">Section Background Theme</span>
              <label htmlFor={sectionBgSelectId} className="sr-only">
                Section Background
              </label>
              <select
                id={sectionBgSelectId}
                value={styles.section.background}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: {
                      ...styles.section,
                      background: e.target.value,
                      bgGradient: '',
                      pattern: '',
                    },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="bg-transparent">Transparent (Default)</option>
                <option value="bg-card text-foreground">Clean Card Surface</option>
                <option value="bg-navy-950 text-white">Patriotic Navy Deep</option>
                <option value="bg-amber-500/10 text-foreground">Civic Gold Warmth</option>
                <option value="bg-white/10 backdrop-blur-md border border-white/20 text-white">
                  Frost Liquid Glass
                </option>
                <option value="bg-rose-500/10 text-foreground">Alert Crimson Tint</option>
                <option value="bg-emerald-500/10 text-foreground">Grassroots Forest Green</option>
              </select>
            </div>

            {/* Civic Gradient Backgrounds */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Civic Gradient Background (Optional)
              </span>
              <label htmlFor={bgGradientSelectId} className="sr-only">
                Section Gradient
              </label>
              <select
                id={bgGradientSelectId}
                value={styles.section.bgGradient}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, bgGradient: e.target.value, pattern: '' },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="">None (Use Solid Theme Above)</option>
                <option value="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
                  Patriotic Midnight Navy
                </option>
                <option value="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-foreground">
                  Civic Gold Glow
                </option>
                <option value="bg-gradient-to-br from-rose-950/80 via-slate-900 to-black text-white">
                  Alert Crimson Stand
                </option>
                <option value="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 text-white">
                  Grassroots Forest Emerald
                </option>
                <option value="bg-gradient-to-br from-white/15 via-white/5 to-white/10 backdrop-blur-lg border border-white/20 text-white">
                  Iridescent Liquid Frost Glass
                </option>
              </select>
            </div>

            {/* Civic Background Texture & Patterns */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Civic Background Texture &amp; Patterns
              </span>
              <label htmlFor={sectionPatternSelectId} className="sr-only">
                Section Pattern
              </label>
              <select
                id={sectionPatternSelectId}
                value={styles.section.pattern}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, pattern: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="">None (Solid / Plain)</option>
                <option value="bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_1.5px,transparent_1.5px)] [background-size:24px_24px]">
                  Civic Dot Matrix (24px Grid)
                </option>
                <option value="bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] [background-size:24px_24px]">
                  Architectural Diagonal Hatch
                </option>
                <option value="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-950 to-slate-950 text-white">
                  Radiant Golden Civic Aura
                </option>
                <option value="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900 to-slate-950 text-white">
                  Midnight Deep Blue Mesh
                </option>
              </select>
            </div>

            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Section Separator Dividers &amp; Cutouts
              </span>
              <label htmlFor={sectionDividerSelectId} className="sr-only">
                Section Divider
              </label>
              <select
                id={sectionDividerSelectId}
                value={styles.section.divider}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, divider: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="">No Divider (None)</option>
                <option value="border-t border-border">Top Hairline Separator</option>
                <option value="border-b border-border">Bottom Hairline Separator</option>
                <option value="border-y border-border">Top &amp; Bottom Separators</option>
                <option value="border-t-4 border-amber-500">Gold Accent Header Bar</option>
                <option value="border-t-4 border-blue-900">Navy Accent Header Bar</option>
                <option value="[clip-path:polygon(0_0,100%_3vw,100%_100%,0_100%)]">
                  Diagonal Slant Cutout (3vw)
                </option>
                <option value="[clip-path:polygon(0_3vw,100%_0,100%_100%,0_100%)]">
                  Reverse Diagonal Slant (-3vw)
                </option>
                <option value="[clip-path:polygon(0_0,100%_0,100%_calc(100%-3vw),0_100%)]">
                  Bottom Diagonal Slant (3vw)
                </option>
                <option value="[clip-path:polygon(0_0,50%_3vw,100%_0,100%_100%,0_100%)]">
                  Triangle Arrow Transition
                </option>
                <option value="rounded-t-[3rem] border-t-2 border-border">
                  Curved Arch Header (3rem)
                </option>
                <option value="rounded-b-[3rem] border-b-2 border-border">
                  Pill Arch Footer (3rem)
                </option>
                <option value="shadow-[0_-8px_24px_-6px_rgba(245,158,11,0.25)] border-t border-amber-500/40">
                  Top Civic Gold Horizon Glow
                </option>
                <option value="shadow-[0_8px_24px_-6px_rgba(245,158,11,0.25)] border-b border-amber-500/40">
                  Bottom Civic Gold Horizon Glow
                </option>
              </select>
            </div>

            <div>
              <span className="block text-slate-300 font-bold mb-1.5">Row Multi-Column Layout</span>

              {/* 1-Click Column Ratio Presets */}
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {VC_COLUMN_PRESETS.map((preset) => {
                  const isSelected = styles.section.columns === preset.value;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setStyles({
                          ...styles,
                          section: { ...styles.section, columns: preset.value },
                        })
                      }
                      className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                        isSelected
                          ? 'border-accent-gold bg-accent-gold/20 text-accent-gold shadow-xs'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                      title={`Set columns to ${preset.label}`}
                      aria-label={`Column layout ${preset.label}`}
                    >
                      <div className="w-full flex gap-0.5 h-2.5 mb-1">
                        {preset.cols.map((col) => (
                          <div
                            key={`${preset.id}-${col.id}`}
                            style={{ width: col.width }}
                            className={`h-full rounded-2xs ${
                              isSelected ? 'bg-accent-gold' : 'bg-white/30'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="truncate w-full text-center text-[9px]">{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <label htmlFor={sectionColumnsSelectId} className="sr-only">
                Column Grid
              </label>
              <select
                id={sectionColumnsSelectId}
                value={styles.section.columns}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, columns: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="">Single Column (Full Width)</option>
                <option value="grid grid-cols-1 md:grid-cols-2">2 Equal Columns (50 / 50)</option>
                <option value="grid grid-cols-1 md:grid-cols-3">3 Columns (33 / 33 / 33)</option>
                <option value="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  4 Columns (25 / 25 / 25 / 25)
                </option>
                <option value="grid grid-cols-1 md:grid-cols-3 [&>*:first-child]:md:col-span-2">
                  Asymmetric Main + Sidebar (66% / 33%)
                </option>
                <option value="grid grid-cols-1 md:grid-cols-3 [&>*:last-child]:md:col-span-2">
                  Asymmetric Sidebar + Main (33% / 66%)
                </option>
              </select>
            </div>

            {styles.section.columns && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={sectionGapSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Column Gap
                  </label>
                  <select
                    id={sectionGapSelectId}
                    value={styles.section.columnGap}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        section: { ...styles.section, columnGap: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="gap-0">Flush (gap-0)</option>
                    <option value="gap-4">Compact (gap-4)</option>
                    <option value="gap-8">Standard (gap-8)</option>
                    <option value="gap-12">Generous (gap-12)</option>
                    <option value="gap-16">Spacious (gap-16)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={sectionAlignSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Vertical Alignment
                  </label>
                  <select
                    id={sectionAlignSelectId}
                    value={styles.section.verticalAlign}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        section: { ...styles.section, verticalAlign: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="items-start">Top Aligned</option>
                    <option value="items-center">Middle Centered</option>
                    <option value="items-end">Bottom Aligned</option>
                    <option value="items-stretch">Stretch Equal Height</option>
                  </select>
                </div>
              </div>
            )}

            {/* Section Radius & Shadow */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={sectionRadiusSelectId}
                  className="text-[10px] text-slate-400 mb-1 block"
                >
                  Section Corner Radius
                </label>
                <select
                  id={sectionRadiusSelectId}
                  value={styles.section.radius}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, radius: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                >
                  <option value="rounded-none">Square (0)</option>
                  <option value="rounded-xl">Subtle (12px)</option>
                  <option value="rounded-2xl">Modern Card (16px)</option>
                  <option value="rounded-3xl">Pill Smooth (24px)</option>
                  <option value="rounded-[2.5rem]">Deep Dramatic (40px)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor={sectionShadowSelectId}
                  className="text-[10px] text-slate-400 mb-1 block"
                >
                  Section Shadow
                </label>
                <select
                  id={sectionShadowSelectId}
                  value={styles.section.shadow}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      section: { ...styles.section, shadow: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                >
                  <option value="shadow-none">Flat (None)</option>
                  <option value="shadow-md">Medium</option>
                  <option value="shadow-xl">High Elevation</option>
                  <option value="shadow-2xl">Maximum Depth</option>
                  <option value="shadow-2xl shadow-amber-500/10">Civic Gold Glow</option>
                </select>
              </div>
            </div>

            {/* Sticky Row Pinning & Print Visibility */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setStyles({
                    ...styles,
                    section: { ...styles.section, sticky: !styles.section.sticky },
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                  styles.section.sticky
                    ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold'
                    : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div>
                  <span className="block text-xs">Sticky Row</span>
                  <span className="text-[10px] text-slate-400">Pin to top on scroll</span>
                </div>
                <span className="text-[10px] font-mono">
                  {styles.section.sticky ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStyles({
                    ...styles,
                    responsive: { ...styles.responsive, hidePrint: !styles.responsive.hidePrint },
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                  styles.responsive.hidePrint
                    ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 font-bold'
                    : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div>
                  <span className="block text-xs">Hide on Print</span>
                  <span className="text-[10px] text-slate-400">Exclude from print</span>
                </div>
                <span className="text-[10px] font-mono">
                  {styles.responsive.hidePrint ? 'HIDDEN' : 'VISIBLE'}
                </span>
              </button>
            </div>

            {/* Section Backdrop Blur & Glassmorphism */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Section Backdrop Glass Effect
              </span>
              <label htmlFor={sectionBackdropBlurSelectId} className="sr-only">
                Section Backdrop Blur
              </label>
              <select
                id={sectionBackdropBlurSelectId}
                value={styles.effects.backdropBlur}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    effects: { ...styles.effects, backdropBlur: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white text-xs"
              >
                <option value="">None (Standard Clear)</option>
                <option value="backdrop-blur-sm">Subtle Frosted (blur-sm)</option>
                <option value="backdrop-blur-md">Medium Frosted Glass (blur-md)</option>
                <option value="backdrop-blur-lg">Deep Glass Surface (blur-lg)</option>
                <option value="backdrop-blur-xl">Ultra Liquid Glass (blur-xl)</option>
              </select>
            </div>

            {/* Section Anchor ID & Custom Classes */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-slate-300 font-bold mb-1">Section Anchor ID</span>
                <label htmlFor={sectionAnchorIdInputId} className="sr-only">
                  Section Anchor ID
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">
                    #
                  </span>
                  <input
                    id={sectionAnchorIdInputId}
                    type="text"
                    value={styles.anchorId}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        anchorId: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                      })
                    }
                    placeholder="e.g. speakers, rsvp"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 py-1.5 pl-6 pr-2.5 text-xs text-white placeholder:text-white/40 focus:border-accent-gold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <span className="block text-slate-300 font-bold mb-1">Section Custom Classes</span>
                <label htmlFor={sectionCustomClassesInputId} className="sr-only">
                  Section Custom Classes
                </label>
                <input
                  id={sectionCustomClassesInputId}
                  type="text"
                  value={styles.customClasses}
                  onChange={(e) => setStyles({ ...styles, customClasses: e.target.value })}
                  placeholder="e.g. border-t border-white/10"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 py-1.5 px-2.5 text-xs text-white placeholder:text-white/40 focus:border-accent-gold focus:outline-none"
                />
              </div>
            </div>

            {/* Section Responsive Device Visibility */}
            <div>
              <span className="block text-slate-300 font-bold mb-1.5">
                Section Responsive Device Visibility
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
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setStyles({
                        ...styles,
                        responsive: {
                          ...styles.responsive,
                          [item.key]: !styles.responsive[item.key],
                        },
                      })
                    }
                    className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-bold transition-colors ${
                      item.active
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.active ? (
                      <EyeOff size={12} />
                    ) : (
                      <Eye size={12} className="text-slate-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 1-Click Style Presets Tab ─────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'presets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-slate-300 font-bold mb-0.5">
                  Professional 1-Click Design Presets
                </span>
                <p className="text-[11px] text-slate-400">
                  Instantly style this block with curated civic palettes and elevations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {VC_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-accent-gold/50 hover:bg-white/10 group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white group-hover:text-accent-gold transition-colors">
                        {preset.name}
                      </span>
                      <span className="rounded-md bg-accent-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-gold">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
                  </div>
                  <Wand2
                    size={13}
                    className="text-slate-400 group-hover:text-accent-gold transition-colors shrink-0 mt-0.5"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Content Tab ──────────────────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'content' && (
          <div className="space-y-4">
            {currentBlock.type === 'heading' && (
              <div className="space-y-3">
                <span className="block text-slate-300 font-bold">Heading Level</span>
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCurrentBlock({ ...currentBlock, level: lvl })}
                      className={`flex-1 py-1.5 rounded-lg font-bold border transition-colors ${
                        currentBlock.level === lvl
                          ? 'bg-accent-gold text-ink-strong border-accent-gold font-black'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      H{lvl}
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor={headingTextId} className="block text-slate-300 font-bold mb-1">
                    Heading Text
                  </label>
                  <textarea
                    id={headingTextId}
                    rows={3}
                    value={currentBlock.html}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
                  />
                </div>
              </div>
            )}

            {currentBlock.type === 'paragraph' && (
              <div className="space-y-2">
                <label htmlFor={paragraphTextId} className="block text-slate-300 font-bold">
                  Paragraph HTML / Content
                </label>
                <textarea
                  id={paragraphTextId}
                  rows={6}
                  value={currentBlock.html}
                  onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40 font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400">Supports rich inline HTML tags.</p>
              </div>
            )}

            {currentBlock.type === 'image' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor={imageSrcId} className="block text-slate-300 font-bold mb-1">
                    Image URL
                  </label>
                  <input
                    id={imageSrcId}
                    type="url"
                    value={currentBlock.src}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, src: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={imageAltId} className="block text-slate-300 font-bold mb-1">
                    Alt Text
                  </label>
                  <input
                    id={imageAltId}
                    type="text"
                    value={currentBlock.alt}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, alt: e.target.value })}
                    placeholder="Describe image for accessibility"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={imageCaptionId} className="block text-slate-300 font-bold mb-1">
                    Caption
                  </label>
                  <input
                    id={imageCaptionId}
                    type="text"
                    value={currentBlock.caption}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, caption: e.target.value })}
                    placeholder="Optional image caption"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {currentBlock.type === 'button' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor={buttonLabelId} className="block text-slate-300 font-bold mb-1">
                    Button Label
                  </label>
                  <input
                    id={buttonLabelId}
                    type="text"
                    value={currentBlock.label}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, label: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={buttonHrefId} className="block text-slate-300 font-bold mb-1">
                    Destination URL
                  </label>
                  <input
                    id={buttonHrefId}
                    type="text"
                    value={currentBlock.href}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, href: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {currentBlock.type === 'callout' && (
              <div className="space-y-3">
                <span className="block text-slate-300 font-bold">Callout Tone</span>
                <div className="flex gap-2">
                  {(['info', 'action', 'warning'] as const).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setCurrentBlock({ ...currentBlock, tone })}
                      className={`flex-1 py-1.5 rounded-lg font-bold border capitalize transition-colors ${
                        currentBlock.tone === tone
                          ? 'bg-accent-gold text-ink-strong border-accent-gold font-black'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor={calloutTextId} className="block text-slate-300 font-bold mb-1">
                    Callout Text
                  </label>
                  <textarea
                    id={calloutTextId}
                    rows={4}
                    value={currentBlock.html}
                    onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {currentBlock.type === 'quote' && (
              <div>
                <label htmlFor={quoteTextId} className="block text-slate-300 font-bold mb-1">
                  Quote Content
                </label>
                <textarea
                  id={quoteTextId}
                  rows={4}
                  value={currentBlock.html}
                  onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
                />
              </div>
            )}

            {(currentBlock.type === 'bulletList' || currentBlock.type === 'orderedList') && (
              <div>
                <label htmlFor={listItemsId} className="block text-slate-300 font-bold mb-1">
                  List Items (one per line)
                </label>
                <textarea
                  id={listItemsId}
                  rows={6}
                  value={currentBlock.items.join('\n')}
                  onChange={(e) =>
                    setCurrentBlock({ ...currentBlock, items: e.target.value.split('\n') })
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono"
                />
              </div>
            )}

            {currentBlock.type === 'code' && (
              <div className="space-y-2">
                <label htmlFor={codeTextId} className="block text-slate-300 font-bold">
                  Code Snippet
                </label>
                <textarea
                  id={codeTextId}
                  rows={6}
                  value={currentBlock.text}
                  onChange={(e) => setCurrentBlock({ ...currentBlock, text: e.target.value })}
                  placeholder="console.log('Civic action');"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-emerald-400 placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
                />
              </div>
            )}

            {currentBlock.type === 'table' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor={tableHeadId} className="block text-slate-300 font-bold mb-1">
                    Table Columns (comma-separated headers)
                  </label>
                  <input
                    id={tableHeadId}
                    type="text"
                    value={currentBlock.head.join(', ')}
                    onChange={(e) =>
                      setCurrentBlock({
                        ...currentBlock,
                        head: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Date, Action, Organizer"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label htmlFor={tableRowsId} className="block text-slate-300 font-bold mb-1">
                    Table Data Rows (one row per line, comma-separated cells)
                  </label>
                  <textarea
                    id={tableRowsId}
                    rows={5}
                    value={currentBlock.rows.map((r) => r.join(', ')).join('\n')}
                    onChange={(e) =>
                      setCurrentBlock({
                        ...currentBlock,
                        rows: e.target.value
                          .split('\n')
                          .filter((line) => line.trim())
                          .map((line) => line.split(',').map((s) => s.trim())),
                      })
                    }
                    placeholder="Nov 5, General Election, Fair Oaks\nDec 12, Organizing Rally, Carmichael"
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {currentBlock.type === 'divider' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
                <span className="block text-slate-300 font-bold">Horizontal Section Divider</span>
                <p className="text-xs text-slate-400">
                  This divider cleanly separates major sections. Customize margins, thickness, and
                  borders in the Box Model tab.
                </p>
                <hr className="my-2 border-t border-accent-gold/40" />
              </div>
            )}

            {currentBlock.type === 'unsupported' && (
              <div className="space-y-2">
                <label htmlFor={unsupportedHtmlId} className="block text-slate-300 font-bold">
                  Raw HTML Markup
                </label>
                <textarea
                  id={unsupportedHtmlId}
                  rows={8}
                  value={currentBlock.html}
                  onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                  placeholder="<div>...</div>"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sky-400 placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Box Model & Design Tab ───────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'design' && (
          <div className="space-y-4">
            {/* Visual Margin & Padding Dropdown Matrix (Compatible with existing tests) */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">Spacing &amp; Padding</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={marginSelectId} className="text-[10px] text-slate-400 mb-1 block">
                    Margin (Y-Axis)
                  </label>
                  <select
                    id={marginSelectId}
                    value={styles.margin.top}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        margin: {
                          ...styles.margin,
                          top: e.target.value,
                          bottom: isSidesLinked ? e.target.value : styles.margin.bottom,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                  >
                    <option value="">None (0)</option>
                    <option value="my-2">Compact (my-2)</option>
                    <option value="my-4">Medium (my-4)</option>
                    <option value="my-6">Large (my-6)</option>
                    <option value="my-8">Extra (my-8)</option>
                    <option value="my-12">Huge (my-12)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={paddingSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Padding
                  </label>
                  <select
                    id={paddingSelectId}
                    value={styles.padding.top}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        padding: {
                          ...styles.padding,
                          top: e.target.value,
                          bottom: isSidesLinked ? e.target.value : styles.padding.bottom,
                          left: isSidesLinked ? e.target.value : styles.padding.left,
                          right: isSidesLinked ? e.target.value : styles.padding.right,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                  >
                    <option value="">None</option>
                    <option value="p-2">Small (p-2)</option>
                    <option value="p-4">Medium (p-4)</option>
                    <option value="p-6">Spacious (p-6)</option>
                    <option value="p-8">Hero (p-8)</option>
                    <option value="p-12">Showcase (p-12)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Interactive 2D Visual CSS Box Model Diagram (Visual Composer Style) ── */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-accent-gold uppercase tracking-wider">
                  Interactive CSS Box Model (4-Sided)
                </span>
                <button
                  type="button"
                  onClick={() => setIsSidesLinked((prev) => !prev)}
                  title={isSidesLinked ? 'Sides Linked (Sync)' : 'Sides Unlinked (Independent)'}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                    isSidesLinked
                      ? 'bg-accent-gold/20 text-accent-gold'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {isSidesLinked ? <Link2 size={10} /> : <Unlink2 size={10} />}
                  <span>{isSidesLinked ? 'Linked' : 'Separate'}</span>
                </button>
              </div>

              {/* Quick Spacing Presets */}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {[
                  { label: 'Default', margin: 'my-2', padding: 'p-4' },
                  { label: 'Card', margin: 'my-4', padding: 'p-6' },
                  { label: 'Spacious', margin: 'my-8', padding: 'p-8' },
                  { label: 'Compact', margin: 'my-1', padding: 'p-2' },
                  { label: 'Flush', margin: '', padding: '' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setStyles({
                        ...styles,
                        margin: { top: preset.margin, bottom: '', left: '', right: '' },
                        padding: { top: preset.padding, bottom: '', left: '', right: '' },
                      })
                    }
                    className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Nested Box Model Canvas with Clickable 4 Sides */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-2 text-center relative transition-colors">
                <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-amber-400/90 tracking-widest uppercase">
                  Margin (Outer)
                </span>

                {/* Top Margin Clickable Pill */}
                <div className="flex justify-center my-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = cycleMarginValue(styles.margin.top, 'vertical');
                      setStyles({
                        ...styles,
                        margin: {
                          ...styles.margin,
                          top: next,
                          bottom: isSidesLinked ? next : styles.margin.bottom,
                        },
                      });
                    }}
                    title="Click to cycle top margin"
                    className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors"
                  >
                    T: {styles.margin.top || '0'}
                  </button>
                </div>

                {/* Middle Row: Left Margin, Border & Padding, Right Margin */}
                <div className="flex items-center gap-1 my-0.5">
                  {/* Left Margin Clickable Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = cycleMarginValue(styles.margin.left, 'horizontal');
                      setStyles({
                        ...styles,
                        margin: {
                          ...styles.margin,
                          left: next,
                          right: isSidesLinked ? next : styles.margin.right,
                        },
                      });
                    }}
                    title="Click to cycle left margin"
                    className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0"
                  >
                    L: {styles.margin.left || '0'}
                  </button>

                  <div className="flex-1 rounded-lg border border-sky-500/40 bg-sky-500/5 p-1.5 relative transition-colors">
                    <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-sky-400/90 tracking-widest uppercase">
                      Border ({styles.border.width}{' '}
                      {styles.border.style !== 'none' ? styles.border.style : ''})
                    </span>

                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-1.5 relative transition-colors mt-2">
                      <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-emerald-400/90 tracking-widest uppercase">
                        Padding (Inner)
                      </span>

                      {/* Top Padding Clickable Pill */}
                      <div className="flex justify-center my-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = cyclePaddingValue(styles.padding.top, 'vertical');
                            setStyles({
                              ...styles,
                              padding: {
                                ...styles.padding,
                                top: next,
                                bottom: isSidesLinked ? next : styles.padding.bottom,
                                left: isSidesLinked ? next : styles.padding.left,
                                right: isSidesLinked ? next : styles.padding.right,
                              },
                            });
                          }}
                          title="Click to cycle top padding"
                          className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                        >
                          T: {styles.padding.top || '0'}
                        </button>
                      </div>

                      {/* Middle Row: Left Padding, Content, Right Padding */}
                      <div className="flex items-center gap-1 my-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = cyclePaddingValue(styles.padding.left, 'horizontal');
                            setStyles({
                              ...styles,
                              padding: {
                                ...styles.padding,
                                left: next,
                                right: isSidesLinked ? next : styles.padding.right,
                                top: isSidesLinked ? next : styles.padding.top,
                                bottom: isSidesLinked ? next : styles.padding.bottom,
                              },
                            });
                          }}
                          title="Click to cycle left padding"
                          className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0"
                        >
                          L: {styles.padding.left || '0'}
                        </button>

                        {/* Content Center */}
                        <div className="flex-1 rounded bg-slate-950 border border-white/20 py-1.5 px-2 text-center shadow-inner">
                          <span className="text-[10px] font-mono font-black text-accent-gold tracking-wide uppercase">
                            [ {currentBlock.type} ]
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const next = cyclePaddingValue(styles.padding.right, 'horizontal');
                            setStyles({
                              ...styles,
                              padding: {
                                ...styles.padding,
                                right: next,
                                left: isSidesLinked ? next : styles.padding.left,
                                top: isSidesLinked ? next : styles.padding.top,
                                bottom: isSidesLinked ? next : styles.padding.bottom,
                              },
                            });
                          }}
                          title="Click to cycle right padding"
                          className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0"
                        >
                          R: {styles.padding.right || '0'}
                        </button>
                      </div>

                      {/* Bottom Padding Clickable Pill */}
                      <div className="flex justify-center my-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = cyclePaddingValue(
                              styles.padding.bottom || styles.padding.top,
                              'vertical'
                            );
                            setStyles({
                              ...styles,
                              padding: {
                                ...styles.padding,
                                bottom: next,
                                top: isSidesLinked ? next : styles.padding.top,
                              },
                            });
                          }}
                          title="Click to cycle bottom padding"
                          className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                        >
                          B: {styles.padding.bottom || styles.padding.top || '0'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Margin Clickable Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = cycleMarginValue(styles.margin.right, 'horizontal');
                      setStyles({
                        ...styles,
                        margin: {
                          ...styles.margin,
                          right: next,
                          left: isSidesLinked ? next : styles.margin.left,
                        },
                      });
                    }}
                    title="Click to cycle right margin"
                    className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0"
                  >
                    R: {styles.margin.right || '0'}
                  </button>
                </div>

                {/* Bottom Margin Clickable Pill */}
                <div className="flex justify-center my-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = cycleMarginValue(
                        styles.margin.bottom || styles.margin.top,
                        'vertical'
                      );
                      setStyles({
                        ...styles,
                        margin: {
                          ...styles.margin,
                          bottom: next,
                          top: isSidesLinked ? next : styles.margin.top,
                        },
                      });
                    }}
                    title="Click to cycle bottom margin"
                    className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors"
                  >
                    B: {styles.margin.bottom || styles.margin.top || '0'}
                  </button>
                </div>
              </div>
            </div>

            {/* Layout Grid & Columns */}
            <div>
              <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
                <Columns3 size={13} className="text-accent-gold" />
                <span>Layout &amp; Multi-Columns</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={layoutColumnsSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Columns Grid
                  </label>
                  <select
                    id={layoutColumnsSelectId}
                    value={styles.layout.columns}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, columns: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Full Width (1 Col)</option>
                    <option value="grid grid-cols-1 md:grid-cols-2 gap-6">2 Columns (50/50)</option>
                    <option value="grid grid-cols-1 md:grid-cols-3 gap-6">
                      3 Columns (33/33/33)
                    </option>
                    <option value="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      4 Columns (25% each)
                    </option>
                    <option value="grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:first-child]:md:col-span-2">
                      Asymmetric (66% / 33%)
                    </option>
                    <option value="grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:last-child]:md:col-span-2">
                      Asymmetric (33% / 66%)
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={layoutMaxWidthSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Container Width
                  </label>
                  <select
                    id={layoutMaxWidthSelectId}
                    value={styles.layout.maxWidth}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, maxWidth: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Default (Inherit)</option>
                    <option value="max-w-2xl mx-auto">Compact (2XL)</option>
                    <option value="max-w-4xl mx-auto">Standard (4XL)</option>
                    <option value="max-w-6xl mx-auto">Wide Canvas (6XL)</option>
                    <option value="w-full">Full Bleed (100%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Borders & Radius */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Border &amp; Corner Radius
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label htmlFor={radiusSelectId} className="text-[10px] text-slate-400 mb-1 block">
                    Corner Radius
                  </label>
                  <select
                    id={radiusSelectId}
                    value={styles.border.radius}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        border: { ...styles.border, radius: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="rounded-none">Square (0)</option>
                    <option value="rounded-md">Subtle (6px)</option>
                    <option value="rounded-xl">Standard (12px)</option>
                    <option value="rounded-2xl">Modern Card (16px)</option>
                    <option value="rounded-3xl">Pill Smooth (24px)</option>
                    <option value="rounded-full">Full Capsule</option>
                    <option value="rounded-t-2xl">Top Rounded</option>
                    <option value="rounded-b-2xl">Bottom Rounded</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={borderWidthSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Border Width
                  </label>
                  <select
                    id={borderWidthSelectId}
                    value={styles.border.width}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        border: { ...styles.border, width: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="border-0">No Border</option>
                    <option value="border">Thin (1px)</option>
                    <option value="border-2">Medium (2px)</option>
                    <option value="border-4">Heavy (4px)</option>
                    <option value="border-8">Thick Accent (8px)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={borderStyleSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Border Style
                  </label>
                  <select
                    id={borderStyleSelectId}
                    value={styles.border.style}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        border: {
                          ...styles.border,
                          style: e.target.value as typeof styles.border.style,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="solid">Solid Line</option>
                    <option value="dashed">Dashed Line</option>
                    <option value="dotted">Dotted Line</option>
                    <option value="double">Double Line</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={borderSideSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Border Sides
                  </label>
                  <select
                    id={borderSideSelectId}
                    value={styles.border.side}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        border: {
                          ...styles.border,
                          side: e.target.value as typeof styles.border.side,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="all">All 4 Sides</option>
                    <option value="left">Left Accent Bar</option>
                    <option value="top">Top Accent Bar</option>
                    <option value="bottom">Bottom Accent Bar</option>
                    <option value="right">Right Accent Bar</option>
                    <option value="y">Top &amp; Bottom</option>
                  </select>
                </div>
              </div>

              {/* Border Color Swatches */}
              <div className="mt-2.5">
                <span className="text-[10px] text-slate-400 mb-1.5 block">Border Color Preset</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { color: 'border-border', label: 'Default', bg: 'bg-white/20' },
                    { color: 'border-amber-500/50', label: 'Civic Gold', bg: 'bg-amber-500' },
                    { color: 'border-blue-900/50', label: 'Patriotic Navy', bg: 'bg-blue-900' },
                    { color: 'border-white/30', label: 'Frost Glass', bg: 'bg-white/40' },
                    { color: 'border-rose-500/50', label: 'Crimson', bg: 'bg-rose-500' },
                    {
                      color: 'border-emerald-500/50',
                      label: 'Forest Green',
                      bg: 'bg-emerald-500',
                    },
                  ].map((preset) => {
                    const isSelected = styles.border.color === preset.color;
                    return (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() =>
                          setStyles({
                            ...styles,
                            border: { ...styles.border, color: preset.color },
                          })
                        }
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors ${
                          isSelected
                            ? 'border-accent-gold bg-accent-gold/15 text-accent-gold font-bold'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${preset.bg}`} />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Background & Shadow */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Background &amp; Elevation
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={bgThemeSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Background Theme
                  </label>
                  <select
                    id={bgThemeSelectId}
                    value={styles.background.preset}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        background: { ...styles.background, preset: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="bg-transparent">Transparent</option>
                    <option value="bg-slate-900/60">Slate Card (60%)</option>
                    <option value="bg-slate-950/90">Deep Midnight</option>
                    <option value="bg-amber-500/10">Civic Gold Light</option>
                    <option value="bg-emerald-500/10">Community Green</option>
                    <option value="bg-rose-500/10">Alert Crimson</option>
                    <option value="bg-white/10">Glass Surface</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={shadowSelectId} className="text-[10px] text-slate-400 mb-1 block">
                    Elevation Shadow
                  </label>
                  <select
                    id={shadowSelectId}
                    value={styles.shadow}
                    onChange={(e) => setStyles({ ...styles, shadow: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="shadow-none">Flat (None)</option>
                    <option value="shadow-sm">Subtle Soft</option>
                    <option value="shadow-md">Medium Card</option>
                    <option value="shadow-lg">Elevated Surface</option>
                    <option value="shadow-xl">High Elevation</option>
                    <option value="shadow-2xl">Maximum Depth</option>
                    <option value="shadow-inner">Inset Recessed</option>
                    <option value="shadow-lg shadow-amber-500/25">Civic Gold Glow</option>
                    <option value="shadow-lg shadow-sky-500/25">Cyan Tech Glow</option>
                    <option value="shadow-2xl shadow-blue-950/60">Patriotic Navy Shadow</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Layout, Display & Max-Width Studio */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Layout, Display &amp; Sizing
              </span>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label
                    htmlFor={layoutDisplaySelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Display Mode
                  </label>
                  <select
                    id={layoutDisplaySelectId}
                    value={styles.layout.display}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, display: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Default (Normal Flow)</option>
                    <option value="block">Block</option>
                    <option value="inline-block">Inline Block</option>
                    <option value="flex">Flex Container</option>
                    <option value="inline-flex">Inline Flex</option>
                    <option value="grid">Grid Container</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={layoutMaxWidthSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Max Width Container
                  </label>
                  <select
                    id={layoutMaxWidthSelectId}
                    value={styles.layout.maxWidth}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, maxWidth: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Full Width (Auto)</option>
                    <option value="max-w-prose">Prose Reading (65ch)</option>
                    <option value="max-w-sm">Small (384px)</option>
                    <option value="max-w-md">Medium (448px)</option>
                    <option value="max-w-lg">Large (512px)</option>
                    <option value="max-w-xl">Extra Large (576px)</option>
                    <option value="max-w-2xl">2X Large (672px)</option>
                    <option value="max-w-4xl">4X Large (896px)</option>
                  </select>
                </div>
              </div>

              {/* Flex Options if display is flex */}
              {(styles.layout.display === 'flex' || styles.layout.display === 'inline-flex') && (
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
                  <div>
                    <label
                      htmlFor={layoutFlexDirSelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Direction
                    </label>
                    <select
                      id={layoutFlexDirSelectId}
                      value={styles.layout.flexDirection}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          layout: { ...styles.layout, flexDirection: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="flex-row">Row</option>
                      <option value="flex-col">Column</option>
                      <option value="flex-row-reverse">Row Rev</option>
                      <option value="flex-col-reverse">Col Rev</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={layoutJustifySelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Justify
                    </label>
                    <select
                      id={layoutJustifySelectId}
                      value={styles.layout.justifyContent}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          layout: { ...styles.layout, justifyContent: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="justify-start">Start</option>
                      <option value="justify-center">Center</option>
                      <option value="justify-end">End</option>
                      <option value="justify-between">Between</option>
                      <option value="justify-around">Around</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={layoutAlignSelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Align Items
                    </label>
                    <select
                      id={layoutAlignSelectId}
                      value={styles.layout.alignItems}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          layout: { ...styles.layout, alignItems: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="items-start">Start</option>
                      <option value="items-center">Center</option>
                      <option value="items-end">End</option>
                      <option value="items-stretch">Stretch</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Positioning & Layering */}
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label
                    htmlFor={layoutPositionSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Position
                  </label>
                  <select
                    id={layoutPositionSelectId}
                    value={styles.layout.position}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, position: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Static</option>
                    <option value="relative">Relative</option>
                    <option value="sticky top-0">Sticky Top-0</option>
                    <option value="sticky top-4">Sticky Top-4</option>
                    <option value="absolute">Absolute</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={layoutZIndexSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Z-Index
                  </label>
                  <select
                    id={layoutZIndexSelectId}
                    value={styles.layout.zIndex}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, zIndex: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Auto</option>
                    <option value="z-0">z-0</option>
                    <option value="z-10">z-10</option>
                    <option value="z-20">z-20</option>
                    <option value="z-30">z-30</option>
                    <option value="z-40">z-40</option>
                    <option value="z-50">z-50</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={layoutOverflowSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Overflow
                  </label>
                  <select
                    id={layoutOverflowSelectId}
                    value={styles.layout.overflow}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        layout: { ...styles.layout, overflow: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Visible</option>
                    <option value="overflow-hidden">Hidden</option>
                    <option value="overflow-auto">Auto Scroll</option>
                    <option value="overflow-x-auto">Scroll X</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Glassmorphism & Visual Effects */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">
                Glassmorphism &amp; Visual Effects
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label
                    htmlFor={effectBackdropBlurSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Backdrop Blur
                  </label>
                  <select
                    id={effectBackdropBlurSelectId}
                    value={styles.effects.backdropBlur}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, backdropBlur: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">None</option>
                    <option value="backdrop-blur-sm">Subtle (sm)</option>
                    <option value="backdrop-blur-md">Medium (md)</option>
                    <option value="backdrop-blur-lg">Deep (lg)</option>
                    <option value="backdrop-blur-xl">Ultra Glass (xl)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={effectOpacitySelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Opacity
                  </label>
                  <select
                    id={effectOpacitySelectId}
                    value={styles.effects.opacity}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, opacity: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">100% Solid</option>
                    <option value="opacity-90">90%</option>
                    <option value="opacity-80">80%</option>
                    <option value="opacity-70">70%</option>
                    <option value="opacity-50">50% Dimmed</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={effectGrayscaleSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Grayscale Filter
                  </label>
                  <select
                    id={effectGrayscaleSelectId}
                    value={styles.effects.grayscale}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, grayscale: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Full Color</option>
                    <option value="grayscale">Full Grayscale</option>
                    <option value="grayscale hover:grayscale-0 transition-all duration-300">
                      Hover Reveal Color
                    </option>
                  </select>
                </div>
              </div>

              {/* CSS Filters & Color Grading */}
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <div>
                  <label
                    htmlFor={effectBrightnessSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Brightness
                  </label>
                  <select
                    id={effectBrightnessSelectId}
                    value={styles.effects.brightness || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, brightness: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">100% Normal</option>
                    <option value="brightness-50">50% Dim</option>
                    <option value="brightness-75">75% Muted</option>
                    <option value="brightness-90">90% Subtle Soft</option>
                    <option value="brightness-110">110% Vivid Boost</option>
                    <option value="brightness-125">125% High Key</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={effectContrastSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Contrast
                  </label>
                  <select
                    id={effectContrastSelectId}
                    value={styles.effects.contrast || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, contrast: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">100% Normal</option>
                    <option value="contrast-75">75% Low Contrast</option>
                    <option value="contrast-125">125% Punchy Contrast</option>
                    <option value="contrast-150">150% High Dynamic</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <div>
                  <label
                    htmlFor={effectSaturateSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Saturation
                  </label>
                  <select
                    id={effectSaturateSelectId}
                    value={styles.effects.saturate || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, saturate: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">100% Normal</option>
                    <option value="saturate-50">50% Desaturated</option>
                    <option value="saturate-150">150% Vibrant Rich</option>
                    <option value="saturate-200">200% Super Saturated</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={effectHueRotateSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Hue Shift (Color Shift)
                  </label>
                  <select
                    id={effectHueRotateSelectId}
                    value={styles.effects.hueRotate || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, hueRotate: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">0° Normal</option>
                    <option value="hue-rotate-15">15° Warm Shift</option>
                    <option value="hue-rotate-30">30° Golden Amber</option>
                    <option value="hue-rotate-60">60° Emerald Green</option>
                    <option value="hue-rotate-90">90° Cyan Accent</option>
                    <option value="hue-rotate-180">180° Inverted Spectrum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <div>
                  <label
                    htmlFor={effectSepiaSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Sepia Vintage
                  </label>
                  <select
                    id={effectSepiaSelectId}
                    value={styles.effects.sepia || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, sepia: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">None (Modern Color)</option>
                    <option value="sepia">Warm Sepia Tone</option>
                    <option value="sepia hover:sepia-0 transition-all duration-300">
                      Hover Reveal Modern
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={effectBlurSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Element Blur Filter
                  </label>
                  <select
                    id={effectBlurSelectId}
                    value={styles.effects.blur || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        effects: { ...styles.effects, blur: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">Sharp (No Blur)</option>
                    <option value="blur-xs">Soft Focus (xs)</option>
                    <option value="blur-sm">Light Blur (sm)</option>
                    <option value="blur-md">Medium Bokeh (md)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Transforms & 3D Tilt Studio */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">Transforms &amp; 3D Tilt</span>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label
                    htmlFor={transformRotateSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Rotation Angle
                  </label>
                  <select
                    id={transformRotateSelectId}
                    value={styles.transform?.rotate || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        transform: { ...styles.transform, rotate: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">0° (Flat)</option>
                    <option value="rotate-1">1° Subtle Right</option>
                    <option value="-rotate-1">-1° Subtle Left</option>
                    <option value="rotate-2">2° Dynamic Angle</option>
                    <option value="-rotate-2">-2° Dynamic Angle</option>
                    <option value="rotate-3">3° Playful Tilt</option>
                    <option value="-rotate-3">-3° Playful Tilt</option>
                    <option value="rotate-6">6° Accent Stamp</option>
                    <option value="-rotate-6">-6° Accent Stamp</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={transformScaleSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Scale Size
                  </label>
                  <select
                    id={transformScaleSelectId}
                    value={styles.transform?.scale || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        transform: { ...styles.transform, scale: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">100% Normal</option>
                    <option value="scale-95">95% Compact</option>
                    <option value="scale-105">105% Spotlight Pop</option>
                    <option value="scale-110">110% Heroic Zoom</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={transformSkewSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Skew Slant
                  </label>
                  <select
                    id={transformSkewSelectId}
                    value={styles.transform?.skew || ''}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        transform: { ...styles.transform, skew: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">None (0°)</option>
                    <option value="skew-x-1">1° Civic Slant</option>
                    <option value="-skew-x-1">-1° Reverse Slant</option>
                    <option value="skew-y-1">1° Vertical Slant</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Typography Tab ───────────────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'typography' && (
          <div className="space-y-4">
            <div>
              <span className="block text-slate-300 font-bold mb-2">Alignment</span>
              <div className="flex gap-2">
                {[
                  { align: 'left', icon: AlignLeft },
                  { align: 'center', icon: AlignCenter },
                  { align: 'right', icon: AlignRight },
                  { align: 'justify', icon: AlignJustify },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = styles.typography.textAlign === item.align;
                  return (
                    <button
                      key={item.align}
                      type="button"
                      onClick={() =>
                        setStyles({
                          ...styles,
                          typography: {
                            ...styles.typography,
                            textAlign: item.align as typeof styles.typography.textAlign,
                          },
                        })
                      }
                      className={`flex-1 flex items-center justify-center p-2 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-accent-gold text-ink-strong border-accent-gold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Family & Size */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={fontFamilySelectId}
                  className="text-[10px] text-slate-400 mb-1 block"
                >
                  Font Family
                </label>
                <select
                  id={fontFamilySelectId}
                  value={styles.typography.fontFamily}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      typography: { ...styles.typography, fontFamily: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                >
                  <option value="">Default Clean Sans</option>
                  <option value="font-serif">Civic Editorial Serif</option>
                  <option value="font-mono">Technical Monospace</option>
                </select>
              </div>
              <div>
                <label htmlFor={fontSizeSelectId} className="text-[10px] text-slate-400 mb-1 block">
                  Font Size
                </label>
                <select
                  id={fontSizeSelectId}
                  value={styles.typography.fontSize}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      typography: { ...styles.typography, fontSize: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                >
                  <option value="text-xs">Compact (xs)</option>
                  <option value="text-sm">Small (sm)</option>
                  <option value="text-base">Body (base)</option>
                  <option value="text-lg">Large (lg)</option>
                  <option value="text-xl">XL (xl)</option>
                  <option value="text-2xl">Hero (2xl)</option>
                  <option value="text-3xl">Display (3xl)</option>
                </select>
              </div>
            </div>

            {/* Weight & Text Gradient */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={fontWeightSelectId}
                  className="text-[10px] text-slate-400 mb-1 block"
                >
                  Weight
                </label>
                <select
                  id={fontWeightSelectId}
                  value={styles.typography.fontWeight}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      typography: { ...styles.typography, fontWeight: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                >
                  <option value="font-normal">Regular (400)</option>
                  <option value="font-medium">Medium (500)</option>
                  <option value="font-semibold">Semi-Bold (600)</option>
                  <option value="font-bold">Bold (700)</option>
                  <option value="font-black">Black (900)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor={textGradientSelectId}
                  className="text-[10px] text-slate-400 mb-1 block"
                >
                  Text Gradient
                </label>
                <select
                  id={textGradientSelectId}
                  value={styles.typography.textGradient}
                  onChange={(e) =>
                    setStyles({
                      ...styles,
                      typography: { ...styles.typography, textGradient: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                >
                  <option value="">None (Solid Color)</option>
                  <option value="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
                    Brand Gold Shine
                  </option>
                  <option value="bg-gradient-to-r from-blue-400 via-slate-100 to-rose-400 bg-clip-text text-transparent">
                    Patriotic Tristate
                  </option>
                  <option value="bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-500 bg-clip-text text-transparent">
                    Grassroots Emerald
                  </option>
                </select>
              </div>
            </div>

            {/* Line Height */}
            <div>
              <label htmlFor={lineHeightSelectId} className="text-[10px] text-slate-400 mb-1 block">
                Line Height
              </label>
              <select
                id={lineHeightSelectId}
                value={styles.typography.lineHeight}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    typography: { ...styles.typography, lineHeight: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
              >
                <option value="leading-relaxed">Relaxed Body (1.625)</option>
                <option value="leading-normal">Normal (1.5)</option>
                <option value="leading-snug">Snug (1.375)</option>
                <option value="leading-tight">Tight Headline (1.25)</option>
                <option value="leading-none">Flush None (1.0)</option>
                <option value="leading-loose">Loose Breathing (2.0)</option>
              </select>
            </div>

            {/* Text Color Swatches */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">Typography Color</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { color: 'text-foreground', label: 'Default Ink', dot: 'bg-white/40' },
                  {
                    color: 'text-navy-900 dark:text-navy-100',
                    label: 'Civic Navy',
                    dot: 'bg-blue-600',
                  },
                  {
                    color: 'text-amber-600 dark:text-amber-400',
                    label: 'Brand Gold',
                    dot: 'bg-amber-500',
                  },
                  { color: 'text-muted-foreground', label: 'Subtle Muted', dot: 'bg-slate-500/80' },
                  { color: 'text-white', label: 'High White', dot: 'bg-white/95' },
                  {
                    color: 'text-rose-600 dark:text-rose-400',
                    label: 'Urgent Red',
                    dot: 'bg-rose-500',
                  },
                  {
                    color: 'text-emerald-700 dark:text-emerald-400',
                    label: 'Success Green',
                    dot: 'bg-emerald-500',
                  },
                ].map((item) => {
                  const isSelected = styles.typography.color === item.color;
                  return (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() =>
                        setStyles({
                          ...styles,
                          typography: { ...styles.typography, color: item.color, textGradient: '' },
                        })
                      }
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-colors ${
                        isSelected
                          ? 'border-accent-gold bg-accent-gold/15 text-accent-gold font-bold'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 mb-1 block">
                Letter Spacing &amp; Casing
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={letterSpacingSelectId} className="sr-only">
                    Letter Spacing
                  </label>
                  <select
                    id={letterSpacingSelectId}
                    value={styles.typography.letterSpacing}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        typography: { ...styles.typography, letterSpacing: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                  >
                    <option value="tracking-normal">Normal</option>
                    <option value="tracking-wide">Wide (+0.025em)</option>
                    <option value="tracking-wider">Wider (+0.05em)</option>
                    <option value="tracking-tight">Tight (-0.025em)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={textTransformSelectId} className="sr-only">
                    Text Transform
                  </label>
                  <select
                    id={textTransformSelectId}
                    value={styles.typography.textTransform}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        typography: {
                          ...styles.typography,
                          textTransform: e.target.value as typeof styles.typography.textTransform,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white"
                  >
                    <option value="none">Normal Casing</option>
                    <option value="uppercase">ALL CAPS</option>
                    <option value="capitalize">Capitalize Words</option>
                    <option value="lowercase">all lowercase</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor={textShadowSelectId} className="text-[10px] text-slate-400 mb-1 block">
                Text Drop Shadow
              </label>
              <select
                id={textShadowSelectId}
                value={styles.typography.textShadow}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    typography: { ...styles.typography, textShadow: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
              >
                <option value="">None (Crisp Flat)</option>
                <option value="drop-shadow-sm">Subtle Soft (sm)</option>
                <option value="drop-shadow-md">High Contrast (md)</option>
                <option value="drop-shadow-lg">Dramatic Depth (lg)</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Raw HTML & Custom CSS Tab ─────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'code' && (
          <div className="space-y-4">
            <div>
              <span className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <Code size={13} className="text-accent-gold" />
                <span>Raw Block HTML Markup</span>
              </span>
              <p className="text-[11px] text-slate-400 mb-2">
                Directly view and edit raw HTML markup. Changes persist to Supabase CMS.
              </p>
              <label htmlFor={rawHtmlInputId} className="sr-only">
                Raw Block HTML
              </label>
              <textarea
                id={rawHtmlInputId}
                rows={8}
                value={
                  'html' in currentBlock && typeof currentBlock.html === 'string'
                    ? currentBlock.html
                    : JSON.stringify(currentBlock, null, 2)
                }
                onChange={(e) => {
                  if ('html' in currentBlock) {
                    setCurrentBlock({ ...currentBlock, html: e.target.value });
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white font-mono text-[11px] focus:border-accent-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor={customClassesInputId} className="block text-slate-300 font-bold mb-1">
                Custom CSS &amp; Tailwind Utilities
              </label>
              <input
                id={customClassesInputId}
                type="text"
                value={styles.customClasses}
                onChange={(e) => setStyles({ ...styles, customClasses: e.target.value })}
                placeholder="e.g. shadow-2xl backdrop-blur-lg hover:rotate-1"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
              />

              {/* Quick Civic Class Tokens */}
              <div className="mt-2.5">
                <span className="text-[10px] text-slate-400 block mb-1">Quick Design Tokens:</span>
                <div className="flex flex-wrap gap-1">
                  {CIVIC_CLASS_PRESETS.map((token) => (
                    <button
                      key={token.label}
                      type="button"
                      onClick={() => {
                        const existing = styles.customClasses.split(/\s+/).filter(Boolean);
                        if (!existing.includes(token.value)) {
                          setStyles({
                            ...styles,
                            customClasses: [...existing, token.value].join(' '),
                          });
                          toast.success(`Appended ${token.label}`);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-[10px] text-slate-300 hover:border-accent-gold/50 hover:bg-white/10 hover:text-accent-gold transition-colors"
                    >
                      +{token.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Advanced & Responsive Tab ─────────────────────────────────── */}
        {inspectorMode === 'block' && activeTab === 'advanced' && (
          <div className="space-y-4">
            {/* Motion & Animations */}
            <div>
              <span className="block text-slate-300 font-bold mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-accent-gold" />
                <span>Motion &amp; Animations</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={motionEntranceSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Entrance Animation
                  </label>
                  <select
                    id={motionEntranceSelectId}
                    value={styles.motion.entrance}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        motion: { ...styles.motion, entrance: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">None (Static)</option>
                    <option value="animate-in fade-in duration-300">Smooth Fade In</option>
                    <option value="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      Slide Up
                    </option>
                    <option value="animate-in fade-in slide-in-from-top-4 duration-300">
                      Slide Down
                    </option>
                    <option value="animate-in fade-in zoom-in-95 duration-200">Zoom In Pop</option>
                    <option value="animate-pulse duration-700">Gentle Pulse</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={motionHoverSelectId}
                    className="text-[10px] text-slate-400 mb-1 block"
                  >
                    Hover Interaction
                  </label>
                  <select
                    id={motionHoverSelectId}
                    value={styles.motion.hover}
                    onChange={(e) =>
                      setStyles({
                        ...styles,
                        motion: { ...styles.motion, hover: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white text-[11px]"
                  >
                    <option value="">None</option>
                    <option value="hover:-translate-y-1 hover:shadow-xl transition-all duration-200">
                      Float Card Up
                    </option>
                    <option value="hover:scale-[1.02] transition-transform duration-200">
                      Scale Pop
                    </option>
                    <option value="hover:ring-2 hover:ring-amber-500/60 transition-all duration-200">
                      Gold Border Glow
                    </option>
                    <option value="hover:opacity-85 transition-opacity duration-200">
                      Subtle Dim
                    </option>
                  </select>
                </div>
              </div>

              {/* Fine-Grained Hover Micro-Interactions Matrix */}
              <div className="mt-2.5 p-2 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[10px] text-accent-gold font-bold uppercase tracking-wider block">
                  Hover Micro-Interactions &amp; Timing
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={motionHoverScaleSelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Scale on Hover
                    </label>
                    <select
                      id={motionHoverScaleSelectId}
                      value={styles.motion.hoverScale}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          motion: { ...styles.motion, hoverScale: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="">None (1.0x)</option>
                      <option value="hover:scale-[1.01]">Subtle (+1%)</option>
                      <option value="hover:scale-[1.02]">Card Pop (+2%)</option>
                      <option value="hover:scale-105">Prominent (+5%)</option>
                      <option value="hover:scale-110">Zoom In (+10%)</option>
                      <option value="hover:scale-95">Press Down (-5%)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={motionHoverLiftSelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Vertical Lift
                    </label>
                    <select
                      id={motionHoverLiftSelectId}
                      value={styles.motion.hoverLift}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          motion: { ...styles.motion, hoverLift: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="">None (0)</option>
                      <option value="hover:-translate-y-0.5">Subtle (-2px)</option>
                      <option value="hover:-translate-y-1">Card Lift (-4px)</option>
                      <option value="hover:-translate-y-2">Float (-8px)</option>
                      <option value="hover:-translate-y-3">Dramatic (-12px)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={motionHoverRotateSelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Hover Rotation
                    </label>
                    <select
                      id={motionHoverRotateSelectId}
                      value={styles.motion.hoverRotate}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          motion: { ...styles.motion, hoverRotate: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="">None (0deg)</option>
                      <option value="hover:rotate-1">Slight CW (+1deg)</option>
                      <option value="hover:-rotate-1">Slight CCW (-1deg)</option>
                      <option value="hover:rotate-2">Playful Tilt (+2deg)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={motionDurationSelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Transition Speed
                    </label>
                    <select
                      id={motionDurationSelectId}
                      value={styles.motion.duration}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          motion: { ...styles.motion, duration: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="">Default</option>
                      <option value="transition-all duration-150">Snappy (150ms)</option>
                      <option value="transition-all duration-200">Standard (200ms)</option>
                      <option value="transition-all duration-300">Smooth (300ms)</option>
                      <option value="transition-all duration-500">Cinematic (500ms)</option>
                      <option value="transition-all duration-700">Ambient (700ms)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label
                      htmlFor={motionDelaySelectId}
                      className="text-[9px] text-slate-400 mb-0.5 block"
                    >
                      Entrance Stagger Delay
                    </label>
                    <select
                      id={motionDelaySelectId}
                      value={styles.motion.delay || ''}
                      onChange={(e) =>
                        setStyles({
                          ...styles,
                          motion: { ...styles.motion, delay: e.target.value },
                        })
                      }
                      className="w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px]"
                    >
                      <option value="">None (0ms)</option>
                      <option value="delay-100">+100ms Stagger</option>
                      <option value="delay-150">+150ms</option>
                      <option value="delay-200">+200ms</option>
                      <option value="delay-300">+300ms</option>
                      <option value="delay-500">+500ms</option>
                      <option value="delay-700">+700ms</option>
                      <option value="delay-1000">+1000ms</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section HTML Anchor ID */}
            <div>
              <label htmlFor={anchorIdInputId} className="block text-slate-300 font-bold mb-1">
                HTML Anchor ID (Section Target)
              </label>
              <input
                id={anchorIdInputId}
                type="text"
                value={styles.anchorId}
                onChange={(e) =>
                  setStyles({
                    ...styles,
                    anchorId: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                  })
                }
                placeholder="e.g. rally-info, volunteer-form"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Allows links like <code className="text-accent-gold">#rally-info</code> to jump
                directly to this block.
              </p>
            </div>

            {/* Device Visibility */}
            <div>
              <span className="block text-slate-300 font-bold mb-2">Device Visibility</span>
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
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setStyles({
                        ...styles,
                        responsive: {
                          ...styles.responsive,
                          [item.key]: !styles.responsive[item.key],
                        },
                      })
                    }
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-colors ${
                      item.active
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.active ? (
                      <EyeOff size={13} />
                    ) : (
                      <Eye size={13} className="text-slate-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Generated CSS Classes Preview */}
            <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Compiled Classnames Preview
              </span>
              <p className="font-mono text-[10px] text-accent-gold break-all">
                {compiledClassNames || '(default block styles)'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-5 py-3">
        <button
          type="button"
          onClick={() => {
            setStyles(DEFAULT_VC_STYLES);
            toast.info('Reset styles to defaults');
          }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw size={13} />
          <span>Reset Styles</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-accent-gold px-4 py-1.5 text-xs font-bold text-ink-strong hover:bg-accent-gold/90 transition-colors shadow-lg font-black"
          >
            {inspectorMode === 'section' ? 'Save Section' : 'Save Block'}
          </button>
        </div>
      </div>
    </aside>
  );
}
