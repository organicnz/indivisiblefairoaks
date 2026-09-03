import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

// ─── cn() – Tailwind class merger ────────────────────────────────────────────
// cn() is used in ~40 components. If it regresses, visual breakage is widespread
// but silent — no runtime error. These tests lock in the contract.
describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('text-white')).toBe('text-white');
  });

  it('merges multiple classes', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('deduplicates conflicting Tailwind utilities — last one wins', () => {
    // tailwind-merge resolves conflicts: p-4 + p-2 → p-2
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional falsy values', () => {
    expect(cn('base', false, null, undefined, 0)).toBe('base');
  });

  it('handles conditional truthy values', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('handles object syntax from clsx', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold');
  });

  it('returns empty string for all falsy inputs', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles array syntax from clsx', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('handles deeply conflicting responsive variants', () => {
    // tailwind-merge understands breakpoint prefixes
    expect(cn('md:px-4', 'md:px-8')).toBe('md:px-8');
  });
});
