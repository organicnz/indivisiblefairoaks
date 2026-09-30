---
name: cms-editor-and-crm
description: Project-specific rules for the Indivisible Fair Oaks visual content editor and grassroots CRM. Use when editing anything under src/components/admin/content/, src/components/admin/crm/, src/lib/blocks/, src/lib/actions/content.ts, src/lib/actions/crm.ts, or the broadcast Edge Function — and whenever a change could make CMS content vanish on publish, change a page's publish state, or send an email.
---

# CMS editor & CRM

Two admin surfaces with a shared theme: **a control that looks like it works is
worse than a visible button**, and **anything that can email a real person needs
its blast radius stated in the code**.

Read `docs/content-editor.md` and `docs/crm-operations.md` for full context. The
rules below are the ones that are easiest to break by accident.

## Never break these

### 1. The editor's markup must survive the sanitizer

`sanitize(serialize(blocks)) === serialize(blocks)` is a property test. It is
the only thing between a new block type and silently vanishing on publish.

```bash
bun vitest run src/lib/__tests__/blocks.test.ts
```

If it fails, the cause is a sanitizer/serializer disagreement or a missing block
type — not a flaky test. A new block that serializes to markup the sanitizer
strips will look perfect in the editor and be gone on publish.

Do not add a block type without checking what the sanitizer allows first. There
is deliberately **no embed block**: `sanitizeWPContent` strips iframes and oEmbed
markup, so the control would do nothing.

### 2. Autosave must not change a page's publish state

Autosave persists with the document's *current* `status`.

Passing `'draft'` unconditionally was a live bug: editing a published page and
pausing 2.5s quietly unpublished it. Taking a page down stays a deliberate act
via the Save button.

### 3. Deleting an image checks every reference first

`deleteContentImage` must refuse when `content.body`, `content.featured_image`
or `content_revisions.body` still points at the object.

An unconditional `storage.remove()` is a data-loss event: the same upload is
routinely used by two blocks, reused as a hero, or referenced by a revision whose
restore would then 404. Prefer leaving an orphan (garbage) over breaking a live
page.

### 4. Spam keywords match on word boundaries

Use `containsSpamKeyword()` from `src/lib/sanitize`. Do not call
`SPAM_KEYWORDS.some((kw) => text.includes(kw))` anywhere.

The substring form deleted whole paragraphs, blocks and buttons over ordinary
English — a paragraph about a **judicial** review contains "judi" — and told
residents their contact message was spam. A fourth matcher re-opens the bug.

The list is still aggressive by design: a bare `slot`, `bonus` or `bingo` *is* a
hit. That is a deliberate tradeoff, documented in
`src/lib/__tests__/sanitize-keywords.test.ts`.

### 5. A self-test send cannot be pointed

`sendCRMBroadcastSelfTest` derives its recipient from the session. It must never
accept an address.

The audience narrowing lives in the `crm-broadcast-send` Edge Function: when
`test_only` is set, `test_recipient` is the whole audience and the `target_*`
query is skipped. Keep the guard there. Moving it to the caller means a preview
can be widened by anything written on the client.

### 6. A new send path must refuse to run in an e2e build

`isE2EMode()` (both `CONTACT_SUBMISSION_TEST_MODE=1` **and** `NEXT_E2E_BUILD=true`)
guards `sendCRMBroadcast`, `sendCRMBroadcastSelfTest` and
`sendCRMDirectEmail`. Copy `sendBlockedInE2E()` into any new one.

The contact form is *not* guarded this way, and the difference is the point. Its
notifier is redirected to a local mock in e2e, and `notifyUrl()` refuses to
fall back to the live URL — so the call is harmless and the suite can still
exercise the delivery-status UI, including its failure branches. Bypassing it
instead would have made those branches untestable, and would have been a change
that looked like a fix while removing coverage.

The CRM paths have no such redirect: they dispatch to a live Edge Function that
talks to Resend, and the audience is a real constituent list. The moment e2e
gains a seeded admin session, a single click in a spec would mail the chapter.

Put the check in the action, not the harness, so the guarantee travels with the
code. Unit tests are not a substitute.

### 7. A `CHECK` constraint that disagrees with the code is a trap

`crm_broadcasts.status` omitted `'queued'`, so the insert failed and **no
broadcast had ever been sent**. Unit tests mock the client and cannot see a
constraint.

When you add a state, update the CHECK in a migration in the same change, and
verify against the real database — not a mock.

### 8. Undo groups by intent, and the stack is snapshots

`src/lib/editor-history.ts`. Handlers declare an intent: `type:<field>` for
typing, `null` for a discrete change. Without grouping, undo removes one
character at a time.

Two traps in the wiring, both of which present as "undo silently does nothing":

- A functional `setState` updater must not read a ref that the same effect then
  mutates. The updater runs during the re-render, sees the advanced value, and
  records no change. Read refs into locals first.
- A snapshot that does not round-trip to an identical string is recorded as a
  edit. Undo, redo and draft restores set `appliedByUs` so the recording effect
  skips them; otherwise one restore looks like two undo steps.

Cmd/Ctrl+Z must be intercepted, not left to the browser: native undo walks the
DOM's own history, which knows nothing about the block model.

### 9. Recovered drafts are offered, never applied

`src/lib/draft-recovery.ts`. A local copy silently replacing the page someone
came back to loses an author's trust permanently. Keep the "Restore" / "Discard"
choice, keep the per-content-id key, and keep the freshness checks.

## Before you finish

```bash
bun run lint:check
bunx tsc --noEmit
bun vitest run
```

`supabase db push --include-all` for migrations, then `bun run types:generate`.
Never hand-edit `src/types/supabase.ts`; it is generated and the next run will
show a phantom diff.

## Reporting

State what you verified and how. "Tests pass" means you ran them. A guard
verified against the live Edge Function is worth more than a unit test that
mocks the client, and the difference is the whole reason bug 7 got shipped.
