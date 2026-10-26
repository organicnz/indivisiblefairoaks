/**
 * Visual Composer / Pro Visual Editor Domain Types
 *
 * Unified single source of truth for block and section design controls,
 * box model matrices, typography styling, CSS filters studio, entrance
 * animations, responsive visibility, and 1-click design presets.
 */

export interface VisualComposerBoxModel {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface VisualComposerSection {
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
  border?: string;
  borderColor?: string;
  overlay?: string;
  bgAttachment?: string;
  bgPosition?: string;
}

export interface VisualComposerTypography {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: string;
  letterSpacing: string;
  textTransform: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
  textDecoration?: string;
  color: string;
  textGradient: string;
  textShadow: string;
}

export interface VisualComposerBorder {
  side: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'y';
  width: string;
  style: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  color: string;
  radius: string;
}

export interface VisualComposerBackground {
  preset: string;
  blur: boolean;
  gradient: string;
}

export interface VisualComposerLayout {
  display: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  columns: string;
  maxWidth: string;
  position: string;
  zIndex: string;
  overflow: string;
}

export interface VisualComposerEffects {
  opacity: string;
  backdropBlur: string;
  grayscale: string;
  brightness?: string;
  contrast?: string;
  saturate?: string;
  sepia?: string;
  hueRotate?: string;
  blur?: string;
}

export interface VisualComposerMotion {
  entrance: string;
  hover: string;
  hoverScale?: string;
  hoverLift?: string;
  hoverRotate?: string;
  duration?: string;
  delay?: string;
}

export interface VisualComposerTransform {
  rotate?: string;
  scale?: string;
  skew?: string;
}

export interface VisualComposerResponsive {
  hideMobile: boolean;
  hideTablet: boolean;
  hideDesktop: boolean;
  hidePrint: boolean;
}

export interface VisualComposerStyles {
  margin: VisualComposerBoxModel;
  padding: VisualComposerBoxModel;
  section: VisualComposerSection;
  typography: VisualComposerTypography;
  border: VisualComposerBorder;
  background: VisualComposerBackground;
  shadow: string;
  layout: VisualComposerLayout;
  effects: VisualComposerEffects;
  motion: VisualComposerMotion;
  transform?: VisualComposerTransform;
  anchorId: string;
  responsive: VisualComposerResponsive;
  animation: string;
  customClasses: string;
}

export type VisualComposerMode = 'block' | 'section';

export type VisualComposerTab =
  | 'presets'
  | 'content'
  | 'design'
  | 'typography'
  | 'code'
  | 'advanced';

export type VisualComposerDevice = 'desktop' | 'tablet' | 'mobile';

export interface VisualComposerColumnSlot {
  id: string;
  width: string;
}

export interface VisualComposerColumnPreset {
  id: string;
  label: string;
  value: string;
  cols: readonly VisualComposerColumnSlot[];
}

export interface VisualComposerCivicPreset {
  label: string;
  value: string;
}

export interface VisualComposerPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  apply: () => Partial<VisualComposerStyles>;
}

export interface VisualComposerPresetCategory {
  id: string;
  label: string;
  presets: VisualComposerPreset[];
}
