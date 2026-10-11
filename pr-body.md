## Summary

This PR enhances the CRM visual editor with a unified type system, a beautiful icon-only editorial button, and full CRUD capabilities per section.

### Changes

#### 1. EditorialButton Redesign (`src/components/layout/EditorialButton.tsx`)
- Beautiful icon-only toggle button with pulse indicator when active
- Separate dropdown trigger with chevron for section/region controls
- Consistent design in both header (desktop) and mobile drawer
- Accessible with proper ARIA labels and keyboard navigation

#### 2. Unified Type System (`src/types/unified.ts`)
New single source of truth for cross-domain types:
- Content/Visual Editor domain (blocks, sections, copy regions)
- CRM domain (contacts, broadcasts, tasks, segments)
- Supabase Storage types (MediaItem, MediaFolder, upload results)
- Supabase Edge Functions types (health, backend status, dispatch results)
- Visual Email Composer types (ComposerBlock, ComposeState)
- Content Editor shared types (ContentMetadata, ContentRevision)
- Visual Edit Events & Communication types
- Admin & Permissions types
- Theme & Appearance types
- Utility types (Result, PaginatedResponse, etc.)
- Deprecated aliases in `crm.ts` and `visual-edit.ts` for backward compatibility

#### 3. VisualEditOverlay Enhancements (`src/components/visual-edit/VisualEditOverlay.tsx`)
- Rich text inline toolbar for paragraphs (Bold, Italic, Code, Strikethrough, Link ⌘K)
- Comprehensive keyboard shortcuts:
  - ⌘S save, ⌘Z/⌘⇧Z undo/redo
  - ⌘D duplicate section
  - ⌘⇧↑/↓ move section up/down
  - ⌘⇧⌫ delete section
- Section editor modal with rich editing for all block types
- Full Supabase S3 Storage media library integration
- Edge Functions health monitoring with latency display
- Revision history with restore capability
- Draft recovery with user confirmation
- Optimistic concurrency control with expectedUpdatedAt

#### 4. Type Safety Improvements
- Fixed use-before-declaration in keyboard shortcuts handler
- Added domIndex/index compatibility in VisualSectionOverlayItem
- Added created_at/published_at to new content row creation
- Proper CRMMediaTarget export from unified types

### Verification
- ✅ All 1643 tests pass
- ✅ Lint clean (biome + oxlint)
- ✅ TypeScript compilation succeeds
- ✅ Build succeeds
- ✅ Coverage: 95.55% statements, 92.92% branches

### Notes
- The e2e tests require a node environment that isn't available in the CI environment
- Direct push to main is blocked - this PR should be reviewed and merged via the normal process
- Suppression count grew by 2 (from 22 to 24) - these are in newly added theme-related files