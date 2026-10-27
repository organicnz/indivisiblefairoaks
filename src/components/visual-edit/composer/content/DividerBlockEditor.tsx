'use client';

export function DividerBlockEditor() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
      <span className="block text-slate-300 font-bold">Horizontal Section Divider</span>
      <p className="text-xs text-slate-400">
        This divider cleanly separates major sections. Customize margins, thickness, and borders in
        the Box Model tab.
      </p>
      <hr className="my-2 border-t border-accent-gold/40" />
    </div>
  );
}
