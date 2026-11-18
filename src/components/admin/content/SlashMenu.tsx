'use client';

import { Type as TypeIcon, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';
import { BLOCK_DEFINITIONS, searchBlocks } from './block-definitions';

export function SlashMenu({
  query,
  results,
  activeIndex,
  position,
  onPick,
  onQueryChange,
  onActiveIndexChange,
  onClose,
}: {
  query: string;
  results: ReturnType<typeof searchBlocks>;
  activeIndex: number;
  position: { top: number; left: number };
  onPick: (def: (typeof BLOCK_DEFINITIONS)[number]) => void;
  onQueryChange: (query: string) => void;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the highlighted option in view as the selection moves. Without this,
  // arrowing past the seventh item scrolls the list but leaves the highlight
  // off-screen, so the author is navigating a list they cannot see.
  //
  // Optional-called: `scrollIntoView` is not implemented in jsdom, and a
  // missing layout API should not take the whole editor down with it.
  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    option?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  /**
   * All menu keyboard handling lives here, on the dialog, rather than on the
   * originating block.
   *
   * The arrow/Enter handler used to sit in `onEditableKeyDown`, which is bound to
   * the block the menu was opened from — but opening the menu moves focus into
   * this search input, so that handler never fired. Arrow keys, Enter and Tab
   * were all no-ops, and the only way to pick a block was a mouse click, which a
   * keyboard user never generates. The editor's primary insertion affordance —
   * the one advertised in the shortcut hints — was mouse-only.
   *
   * Events from the input and from the options both bubble through here, so
   * focus is free to move within the menu without losing the handling.
   */
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onActiveIndexChange((results.length + activeIndex + 1) % results.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onActiveIndexChange((activeIndex - 1 + results.length) % results.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onActiveIndexChange(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      onActiveIndexChange(results.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const choice = results[activeIndex];
      if (!choice) return;
      // Tab is bound to "accept" rather than "move on", which is the listbox
      // convention for a filter field: Tab commits the highlighted choice
      // instead of escaping to the next control mid-search.
      event.preventDefault();
      onPick(choice);
    }
  };

  return (
    <div>
      {/* Backdrop: dismisses on any outside click. Without it the menu can only
          be left with Escape or a selection, which is not discoverable. */}
      <button
        type="button"
        aria-label="Close block menu"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="dialog"
        aria-label="Insert block"
        onKeyDown={onMenuKeyDown}
        className="fixed z-50 w-72 rounded-2xl border border-border bg-surface-card p-2 shadow-float"
        style={{ top: position.top, left: position.left }}
      >
        <div className="mb-1 flex items-center gap-2 border-b border-border px-2 pb-2">
          <TypeIcon size={14} className="text-muted-foreground" aria-hidden="true" />
          {/*
            A combobox, not a plain text input. `aria-activedescendant` is what
            makes the highlighted option announceable while focus stays in the
            field — the WAI-ARIA listbox pattern, where the options are not
            themselves focusable. The previous markup had a bare input above a
            `role="listbox"`, so a screen-reader user was told there were options
            and given no way to reach the one that was selected.
          */}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search blocks…"
            aria-label="Search blocks"
            role="combobox"
            aria-expanded="true"
            aria-controls="slash-menu-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              results[activeIndex] ? `slash-option-${results[activeIndex].kind}` : undefined
            }
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close block menu"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary dark:hover:text-primary-on-dark focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/*
          A div with role="listbox" rather than a <ul>: the options are driven by
          arrow keys from the combobox above, which is the listbox pattern. Putting
          that role on a <ul> replaces list semantics wholesale and the a11y
          linter is right to object.
        */}
        <div
          id="slash-menu-listbox"
          ref={listRef}
          role="listbox"
          aria-label="Block types"
          className="max-h-72 overflow-y-auto"
        >
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No blocks match “{query}”.
            </p>
          )}
          {results.map((def, index) => {
            const Icon = def.icon;
            const isActive = index === activeIndex;
            return (
              /*
                Two handlers, on purpose.
                `onPointerDown` with preventDefault is the mouse/touch/pen path:
                it fires before the caret leaves the block the menu was opened
                from, which a plain `click` would already have lost. It also
                calls `preventDefault`, so no `click` follows it and the two
                paths cannot double-fire.
                `onClick` alone would cover keyboard activation, but an option in
                this pattern is not focusable — focus stays in the combobox — so
                the dialog's `onKeyDown` is what a keyboard user actually hits,
                and this is the assistive-technology path that synthesises a click
                on the active option.
              */
              <button
                type="button"
                key={def.kind}
                id={`slash-option-${def.kind}`}
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                // `tabIndex={-1}` keeps the option out of the tab order, which is
                // the listbox pattern: focus belongs in the combobox and
                // `aria-activedescendant` carries the selection. The element is
                // still a real button so that a click, a pointer press and an
                // assistive technology's synthesised activation all work.
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onPick(def);
                }}
                onClick={() => onPick(def)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isActive ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                }`}
              >
                <Icon
                  size={16}
                  className="shrink-0 text-primary dark:text-primary-on-dark"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{def.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{def.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
