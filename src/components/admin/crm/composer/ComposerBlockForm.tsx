'use client';

import {
  ChevronDown,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import type { CalloutBlock, ComposerBlock, ImageBlock, ListBlock, SocialPlatform } from './types';

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{district}}', label: 'Congressional District' },
  { tag: '{{city}}', label: 'City / Neighborhood' },
  { tag: '{{email}}', label: 'Email Address' },
];

interface ComposerBlockFormProps {
  block: ComposerBlock;
  updateBlock: (id: string, updates: Partial<ComposerBlock>) => void;
  activeTokenBlockId: string | null;
  setActiveTokenBlockId: (id: string | null) => void;
  tokenPickerRef: RefObject<HTMLDivElement | null>;
  tokenTriggerRef: RefObject<HTMLButtonElement | null>;
  insertTokenIntoBlock: (blockId: string, token: string) => void;
  openMediaLibraryForBlock: (blockId: string) => void;
  uploadingBlockId: string | null;
  handleQuickUploadForBlock: (blockId: string, e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * The edit form for one composer block.
 *
 * Each branch narrows `block` by `type`, so the fields stay type-safe without a
 * per-type component for every small field set. Keeping the forms out of the
 * canvas leaves that component responsible for ordering and history only.
 */
export function ComposerBlockForm({
  block,
  updateBlock,
  activeTokenBlockId,
  setActiveTokenBlockId,
  tokenPickerRef,
  tokenTriggerRef,
  insertTokenIntoBlock,
  openMediaLibraryForBlock,
  uploadingBlockId,
  handleQuickUploadForBlock,
}: ComposerBlockFormProps) {
  return (
    <div className="space-y-3">
                      {/* HEADER BLOCK */}
                      {block.type === 'header' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <label className="sm:col-span-3 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Eyebrow Badge (Optional)</span>
                              <input
                                type="text"
                                value={block.eyebrow || ''}
                                onChange={(e) => updateBlock(block.id, { eyebrow: e.target.value })}
                                placeholder="e.g. RALLY ALERT or BREAKING"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Hierarchy</span>
                              <select
                                value={block.level || 1}
                                onChange={(e) =>
                                  updateBlock(block.id, { level: Number(e.target.value) as 1 | 2 })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              >
                                <option value={1}>H1 (Main Title)</option>
                                <option value={2}>H2 (Section Header)</option>
                              </select>
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Headline Text</span>
                            <input
                              type="text"
                              value={block.heading}
                              onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                              placeholder="e.g. Stand Up for Democracy in Fair Oaks"
                              className="w-full px-3 py-2 rounded-xl border border-border text-sm font-black text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                          </label>
                        </div>
                      )}

                      {/* TEXT BLOCK */}
                      {block.type === 'text' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="block text-[10px] font-black uppercase text-muted-foreground">
                              Message Content (Plain Text / Markdown)
                            </span>
                            <div
                              className="relative"
                              ref={activeTokenBlockId === block.id ? tokenPickerRef : undefined}
                            >
                              <button
                                type="button"
                                ref={
                                  activeTokenBlockId === block.id ? tokenTriggerRef : undefined
                                }
                                onClick={() =>
                                  setActiveTokenBlockId(
                                    activeTokenBlockId === block.id ? null : block.id
                                  )
                                }
                                aria-expanded={activeTokenBlockId === block.id}
                                aria-label="Insert personalization merge tag"
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-muted hover:bg-surface-muted text-foreground flex items-center gap-1"
                              >
                                <span>+ Insert Tag</span>
                                <ChevronDown size={11} />
                              </button>
                              {activeTokenBlockId === block.id && (
                                <div
                                  role="group"
                                  aria-label="Available merge tags"
                                  data-testid="merge-tag-menu"
                                  className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-surface-card border border-border shadow-lg p-1.5 z-20 space-y-0.5"
                                >
                                  {MERGE_TAGS.map((t) => (
                                    <button
                                      key={t.tag}
                                      type="button"
                                      onClick={() => insertTokenIntoBlock(block.id, t.tag)}
                                      className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-surface-muted font-medium text-foreground flex items-center justify-between"
                                    >
                                      <span>{t.label}</span>
                                      <code className="text-[9px] font-mono text-muted-foreground">
                                        {t.tag}
                                      </code>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <textarea
                            rows={4}
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            placeholder="Type message narrative, bullet points, or updates..."
                            aria-label="Message Content"
                            className="w-full px-3 py-2 rounded-xl border border-border text-xs text-foreground leading-relaxed font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                        </div>
                      )}

                      {/* IMAGE BLOCK */}
                      {block.type === 'image' && (
                        <div className="space-y-3">
                          {/* Supabase Storage Controls */}
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-muted border border-border">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                <ImageIcon
                                  size={14}
                                  className="text-primary dark:text-primary-on-dark"
                                />
                                <span>Supabase S3 Media</span>
                              </span>
                              {block.url?.includes('/storage/v1/object/public/media/') && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  ✓ Hosted in Storage
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openMediaLibraryForBlock(block.id)}
                                className="px-2.5 py-1 rounded-lg bg-surface-card border border-border hover:bg-surface-muted text-foreground text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                              >
                                <FolderOpen
                                  size={13}
                                  className="text-primary dark:text-primary-on-dark"
                                />
                                <span>Browse Storage</span>
                              </button>
                              <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs">
                                {uploadingBlockId === block.id ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud size={13} />
                                    <span>Upload New</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  aria-label="Upload new media file"
                                  onChange={(e) => handleQuickUploadForBlock(block.id, e)}
                                  disabled={uploadingBlockId === block.id}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>

                          {/* Image preview thumbnail inside form if url is set */}
                          {block.url && (
                            <div className="relative aspect-video max-h-48 rounded-xl border border-border overflow-hidden bg-surface-muted flex items-center justify-center">
                              {/* biome-ignore lint/performance/noImgElement: user-supplied external campaign banner in visual composer preview */}
                              <img
                                src={block.url}
                                alt={block.alt || 'Preview'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Image URL *</span>
                              <input
                                type="url"
                                value={block.url}
                                onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                                placeholder="https://... or select from Supabase Storage"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Alignment</span>
                              <select
                                value={block.alignment || 'center'}
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    alignment: e.target.value as ImageBlock['alignment'],
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              >
                                <option value="center">Center</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="full">Full Width</option>
                              </select>
                            </label>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Alt Text (Accessibility)</span>
                              <input
                                type="text"
                                value={block.alt}
                                onChange={(e) => updateBlock(block.id, { alt: e.target.value })}
                                placeholder="e.g. Fair Oaks democracy rally attendees"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Click-through Link URL (Optional)</span>
                              <input
                                type="url"
                                value={block.linkUrl || ''}
                                onChange={(e) => updateBlock(block.id, { linkUrl: e.target.value })}
                                placeholder="https://indivisiblefairoaks.org/actions"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Caption Note (Optional)</span>
                            <input
                              type="text"
                              value={block.caption || ''}
                              onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                              placeholder="Photo credit or brief note..."
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* QUOTE BLOCK */}
                      {block.type === 'quote' && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Quote Copy *</span>
                            <textarea
                              rows={2}
                              value={block.quote}
                              onChange={(e) => updateBlock(block.id, { quote: e.target.value })}
                              placeholder="Inspiring quote from an organizer, constituent, or speaker..."
                              className="w-full px-3 py-2 rounded-xl border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Author / Speaker *</span>
                              <input
                                type="text"
                                value={block.author}
                                onChange={(e) => updateBlock(block.id, { author: e.target.value })}
                                placeholder="e.g. Maria Gonzalez"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Role / Title (Optional)</span>
                              <input
                                type="text"
                                value={block.role || ''}
                                onChange={(e) => updateBlock(block.id, { role: e.target.value })}
                                placeholder="e.g. Fair Oaks Volunteer Coordinator"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* STAT BLOCK */}
                      {block.type === 'stat' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Stat / Metric *</span>
                              <input
                                type="text"
                                value={block.value}
                                onChange={(e) => updateBlock(block.id, { value: e.target.value })}
                                placeholder="e.g. $12,450 or 850+"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-black text-primary dark:text-primary-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              />
                            </label>
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Metric Label *</span>
                              <input
                                type="text"
                                value={block.label}
                                onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                                placeholder="e.g. Grassroots Funds Raised or Doors Knocked"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Context / Explanation (Optional)</span>
                            <input
                              type="text"
                              value={block.description || ''}
                              onChange={(e) =>
                                updateBlock(block.id, { description: e.target.value })
                              }
                              placeholder="e.g. Across Carmichael, Fair Oaks, and Citrus Heights"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* LIST BLOCK */}
                      {block.type === 'list' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">
                              List Items
                            </span>
                            <select
                              value={block.style}
                              aria-label="List formatting style"
                              onChange={(e) =>
                                updateBlock(block.id, {
                                  style: e.target.value as ListBlock['style'],
                                })
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-bold border border-border text-foreground"
                            >
                              <option value="bullet">Bullet Points (•)</option>
                              <option value="numbered">Numbered List (1, 2, 3)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            {block.items.map((item, itemIdx) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: dynamic form inputs without permanent database IDs
                              <div key={itemIdx} className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-muted-foreground w-4 text-right">
                                  {block.style === 'numbered' ? `${itemIdx + 1}.` : '•'}
                                </span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => {
                                    const nextItems = [...block.items];
                                    nextItems[itemIdx] = e.target.value;
                                    updateBlock(block.id, { items: nextItems });
                                  }}
                                  placeholder="List item copy..."
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextItems = block.items.filter((_, i) => i !== itemIdx);
                                    updateBlock(block.id, {
                                      items: nextItems.length ? nextItems : [''],
                                    });
                                  }}
                                  className="p-1 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 rounded"
                                  title="Delete item"
                                  aria-label={`Delete list item ${itemIdx + 1}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateBlock(block.id, { items: [...block.items, ''] })}
                              className="text-[10px] font-bold text-primary dark:text-primary-on-dark hover:underline flex items-center gap-1 mt-1"
                            >
                              <Plus size={11} /> Add another item
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SOCIAL CHANNELS BLOCK */}
                      {block.type === 'social' && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Section Heading</span>
                            <input
                              type="text"
                              value={block.heading || ''}
                              onChange={(e) => updateBlock(block.id, { heading: e.target.value })}
                              placeholder="e.g. Connect With Our Campaign"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <div className="space-y-2">
                            {block.channels.map((ch, chIdx) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: dynamic form inputs without permanent database IDs
                              <div key={chIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                  value={ch.platform}
                                  aria-label={`Social channel ${chIdx + 1} platform`}
                                  onChange={(e) => {
                                    const next = [...block.channels];
                                    next[chIdx] = {
                                      ...ch,
                                      platform: e.target.value as SocialPlatform,
                                    };
                                    updateBlock(block.id, { channels: next });
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground"
                                >
                                  <option value="website">Website</option>
                                  <option value="actblue">ActBlue / Donate</option>
                                  <option value="facebook">Facebook</option>
                                  <option value="instagram">Instagram</option>
                                  <option value="twitter">X / Twitter</option>
                                  <option value="substack">Substack</option>
                                </select>
                                <input
                                  type="url"
                                  value={ch.url}
                                  aria-label={`Social channel ${chIdx + 1} destination URL`}
                                  onChange={(e) => {
                                    const next = [...block.channels];
                                    next[chIdx] = { ...ch, url: e.target.value };
                                    updateBlock(block.id, { channels: next });
                                  }}
                                  placeholder="https://..."
                                  className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground"
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, {
                                  channels: [
                                    ...block.channels,
                                    {
                                      platform: 'website',
                                      url: 'https://indivisiblefairoaks.org',
                                      label: 'Website',
                                    },
                                  ],
                                })
                              }
                              className="text-[10px] font-bold text-primary dark:text-primary-on-dark hover:underline flex items-center gap-1 mt-1"
                            >
                              <Plus size={11} /> Add link channel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CALLOUT BLOCK */}
                      {block.type === 'callout' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Callout Header</span>
                              <input
                                type="text"
                                value={block.title || ''}
                                onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                placeholder="e.g. Urgent Vote / Notice"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Callout Style</span>
                              <select
                                value={block.variant || 'info'}
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    variant: e.target.value as CalloutBlock['variant'],
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              >
                                <option value="info">Info (Blue)</option>
                                <option value="alert">Alert (Amber)</option>
                                <option value="success">Success / Match (Green)</option>
                              </select>
                            </label>
                          </div>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Callout Message</span>
                            <textarea
                              rows={2}
                              value={block.text}
                              onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                              placeholder="Key takeaway, challenge deadline, or call script..."
                              className="w-full px-3 py-2 rounded-xl border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* BUTTON BLOCK */}
                      {block.type === 'button' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Button Label</span>
                            <input
                              type="text"
                              value={block.label}
                              onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                              placeholder="e.g. RSVP for Town Hall"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Target Destination URL</span>
                            <input
                              type="url"
                              value={block.url}
                              onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                              placeholder="https://indivisiblefairoaks.org/actions"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}

                      {/* EVENT BLOCK */}
                      {block.type === 'event' && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Event Title</span>
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                              placeholder="e.g. Saturday Rally for Democracy"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Date & Time</span>
                              <input
                                type="text"
                                value={block.date}
                                onChange={(e) => updateBlock(block.id, { date: e.target.value })}
                                placeholder="Saturday, Oct 14 · 10am"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                            <label className="sm:col-span-2 block text-[10px] font-black uppercase text-muted-foreground">
                              <span className="block mb-1">Location / Venue</span>
                              <input
                                type="text"
                                value={block.location}
                                onChange={(e) =>
                                  updateBlock(block.id, { location: e.target.value })
                                }
                                placeholder="Carmichael Park Main Pavilion"
                                className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* DIVIDER BLOCK */}
                      {block.type === 'divider' && (
                        <div className="py-2 text-center text-muted-foreground">
                          <div className="h-px w-full bg-surface-muted" />
                        </div>
                      )}

                      {/* SIGNOFF BLOCK */}
                      {block.type === 'signoff' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Closing Salutation</span>
                            <input
                              type="text"
                              value={block.closing}
                              onChange={(e) => updateBlock(block.id, { closing: e.target.value })}
                              placeholder="In solidarity,"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                          <label className="block text-[10px] font-black uppercase text-muted-foreground">
                            <span className="block mb-1">Organizer / Team Name</span>
                            <input
                              type="text"
                              value={block.sender}
                              onChange={(e) => updateBlock(block.id, { sender: e.target.value })}
                              placeholder="Indivisible Fair Oaks Steering Committee"
                              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            />
                          </label>
                        </div>
                      )}    </div>
  );
}
