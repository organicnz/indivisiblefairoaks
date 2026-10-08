'use client';

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Copy,
  ExternalLink,
  Heading,
  Minus,
  PenTool,
  Trash2,
  Type,
} from 'lucide-react';
import type { CalloutBlock, ComposerBlock } from './types';

interface Props {
  blocks: ComposerBlock[];
  onChange: (blocks: ComposerBlock[]) => void;
}

function genId(): string {
  return `b_${Math.random().toString(36).slice(2, 9)}`;
}

export function VisualComposerCanvas({ blocks, onChange }: Props) {
  const updateBlock = (id: string, updates: Partial<ComposerBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...updates } as ComposerBlock) : b)));
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) {
      // Keep at least one empty text block
      onChange([{ id: genId(), type: 'text', content: '' }]);
      return;
    }
    onChange(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const next = [...blocks];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onChange(next);
  };

  const duplicateBlock = (index: number) => {
    const target = blocks[index];
    const clone: ComposerBlock = {
      ...target,
      id: genId(),
    };
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    onChange(next);
  };

  const addBlock = (type: ComposerBlock['type']) => {
    let newBlock: ComposerBlock;
    switch (type) {
      case 'header':
        newBlock = {
          id: genId(),
          type: 'header',
          eyebrow: 'ACTION ALERT',
          heading: 'New Campaign Headline',
          level: 1,
        };
        break;
      case 'text':
        newBlock = { id: genId(), type: 'text', content: '' };
        break;
      case 'callout':
        newBlock = {
          id: genId(),
          type: 'callout',
          variant: 'info',
          title: 'Important Update',
          text: 'Details for your organizers and volunteers.',
        };
        break;
      case 'button':
        newBlock = {
          id: genId(),
          type: 'button',
          label: 'RSVP / Take Action',
          url: 'https://indivisiblefairoaks.org',
          variant: 'primary',
        };
        break;
      case 'event':
        newBlock = {
          id: genId(),
          type: 'event',
          title: 'Chapter Meeting',
          date: 'Saturday, 10:00 AM',
          location: 'Carmichael Park',
          rsvpUrl: '',
        };
        break;
      case 'divider':
        newBlock = { id: genId(), type: 'divider' };
        break;
      case 'signoff':
        newBlock = {
          id: genId(),
          type: 'signoff',
          closing: 'In solidarity,',
          sender: 'Indivisible Fair Oaks Organizing Team',
        };
        break;
    }
    onChange([...blocks, newBlock]);
  };

  const insertTokenIntoBlock = (blockId: string, token: string) => {
    onChange(
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (b.type === 'text') {
          return { ...b, content: `${b.content} ${token} ` };
        }
        if (b.type === 'header') {
          return { ...b, heading: `${b.heading} ${token} ` };
        }
        if (b.type === 'callout') {
          return { ...b, text: `${b.text} ${token} ` };
        }
        return b;
      })
    );
  };

  return (
    <div className="space-y-4">
      {/* Visual Canvas Block List */}
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === blocks.length - 1;

          return (
            <div
              key={block.id}
              className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
            >
              {/* Block Header & Action Controls */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                    {block.type === 'header' && <Heading size={12} className="text-primary" />}
                    {block.type === 'text' && <Type size={12} className="text-slate-500" />}
                    {block.type === 'callout' && (
                      <AlertCircle size={12} className="text-amber-500" />
                    )}
                    {block.type === 'button' && (
                      <ExternalLink size={12} className="text-blue-500" />
                    )}
                    {block.type === 'event' && <Calendar size={12} className="text-purple-500" />}
                    {block.type === 'divider' && <Minus size={12} className="text-slate-400" />}
                    {block.type === 'signoff' && <PenTool size={12} className="text-emerald-500" />}
                    {block.type}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                </div>

                {/* Reorder and management toolbar */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 'up')}
                    disabled={isFirst}
                    title="Move up"
                    className="p-1 rounded text-slate-400 hover:text-secondary hover:bg-slate-100 disabled:opacity-20"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 'down')}
                    disabled={isLast}
                    title="Move down"
                    className="p-1 rounded text-slate-400 hover:text-secondary hover:bg-slate-100 disabled:opacity-20"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateBlock(idx)}
                    title="Duplicate block"
                    className="p-1 rounded text-slate-400 hover:text-secondary hover:bg-slate-100"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    title="Delete block"
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Block Body Content Editing */}
              {block.type === 'header' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label className="sm:col-span-3 block text-[10px] font-black uppercase text-slate-400">
                      <span className="block mb-1">Eyebrow Badge (Optional)</span>
                      <input
                        type="text"
                        value={block.eyebrow || ''}
                        onChange={(e) => updateBlock(block.id, { eyebrow: e.target.value })}
                        placeholder="e.g. RALLY ALERT or BREAKING"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                    <label className="block text-[10px] font-black uppercase text-slate-400">
                      <span className="block mb-1">Hierarchy</span>
                      <select
                        value={block.level || 1}
                        onChange={(e) =>
                          updateBlock(block.id, { level: Number(e.target.value) as 1 | 2 })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      >
                        <option value={1}>H1 (Main Title)</option>
                        <option value={2}>H2 (Section Header)</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Headline Text</span>
                    <input
                      type="text"
                      value={block.heading}
                      onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                      placeholder="e.g. Stand Up for Democracy in Fair Oaks"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                </div>
              )}

              {block.type === 'text' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="block text-[10px] font-black uppercase text-slate-400">
                      Message Content (Plain Text / Markdown)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">Insert tag:</span>
                      <button
                        type="button"
                        onClick={() => insertTokenIntoBlock(block.id, '{{first_name}}')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        {'{{first_name}}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTokenIntoBlock(block.id, '{{district}}')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        {'{{district}}'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    placeholder="Type message narrative, bullet points, or updates..."
                    aria-label="Message Content"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              )}

              {block.type === 'callout' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="sm:col-span-2 block text-[10px] font-black uppercase text-slate-400">
                      <span className="block mb-1">Callout Header</span>
                      <input
                        type="text"
                        value={block.title || ''}
                        onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                        placeholder="e.g. Urgent Vote / Notice"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                    <label className="block text-[10px] font-black uppercase text-slate-400">
                      <span className="block mb-1">Callout Style</span>
                      <select
                        value={block.variant || 'info'}
                        onChange={(e) =>
                          updateBlock(block.id, {
                            variant: e.target.value as CalloutBlock['variant'],
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      >
                        <option value="info">Info (Blue)</option>
                        <option value="alert">Alert (Amber)</option>
                        <option value="success">Success / Match (Green)</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Callout Message</span>
                    <textarea
                      rows={2}
                      value={block.text}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      placeholder="Key takeaway, challenge deadline, or call script..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                </div>
              )}

              {block.type === 'button' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Button Label</span>
                    <input
                      type="text"
                      value={block.label}
                      onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                      placeholder="e.g. RSVP for Town Hall"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Target Destination URL</span>
                    <input
                      type="url"
                      value={block.url}
                      onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                      placeholder="https://indivisiblefairoaks.org/actions"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                </div>
              )}

              {block.type === 'event' && (
                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Event Title</span>
                    <input
                      type="text"
                      value={block.title}
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                      placeholder="e.g. Saturday Rally for Democracy"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block text-[10px] font-black uppercase text-slate-400">
                      <span className="block mb-1">Date & Time</span>
                      <input
                        type="text"
                        value={block.date}
                        onChange={(e) => updateBlock(block.id, { date: e.target.value })}
                        placeholder="Saturday, Oct 14 · 10am"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                    <label className="sm:col-span-2 block text-[10px] font-black uppercase text-slate-400">
                      <span className="block mb-1">Location / Venue</span>
                      <input
                        type="text"
                        value={block.location}
                        onChange={(e) => updateBlock(block.id, { location: e.target.value })}
                        placeholder="Carmichael Park Main Pavilion"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'divider' && (
                <div className="py-2 text-center text-slate-300">
                  <div className="h-px w-full bg-slate-200" />
                </div>
              )}

              {block.type === 'signoff' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Closing Salutation</span>
                    <input
                      type="text"
                      value={block.closing}
                      onChange={(e) => updateBlock(block.id, { closing: e.target.value })}
                      placeholder="In solidarity,"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    <span className="block mb-1">Organizer / Team Name</span>
                    <input
                      type="text"
                      value={block.sender}
                      onChange={(e) => updateBlock(block.id, { sender: e.target.value })}
                      placeholder="Indivisible Fair Oaks Steering Committee"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Block Action Bar */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
          + Add Section Block
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addBlock('header')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <Heading size={13} className="text-primary" />
            Headline
          </button>
          <button
            type="button"
            onClick={() => addBlock('text')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <Type size={13} className="text-slate-600" />
            Text / Story
          </button>
          <button
            type="button"
            onClick={() => addBlock('callout')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <AlertCircle size={13} className="text-amber-600" />
            Callout Box
          </button>
          <button
            type="button"
            onClick={() => addBlock('button')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <ExternalLink size={13} className="text-blue-600" />
            CTA Button
          </button>
          <button
            type="button"
            onClick={() => addBlock('event')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <Calendar size={13} className="text-purple-600" />
            Event Card
          </button>
          <button
            type="button"
            onClick={() => addBlock('divider')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <Minus size={13} className="text-slate-400" />
            Divider
          </button>
          <button
            type="button"
            onClick={() => addBlock('signoff')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-secondary hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <PenTool size={13} className="text-emerald-600" />
            Sign-off
          </button>
        </div>
      </div>
    </div>
  );
}
