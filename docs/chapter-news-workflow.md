# Publishing chapter news

This is the chapter-editor workflow for Erin's ongoing news submissions. It covers the two editorial paths on the site, how to publish safely, and what to check afterward. The admin entry point is `/admin/news`; both paths require an admin account. `/news` is article-first: published posts lead the page, followed by the bulletin callout, meeting materials, the action-alert subscription, and national resources.

## Choose the right format

| Format | Use it for | Where it appears | Admin path |
|---|---|---|---|
| **Post** | Reports, statements, event recaps, longer articles | `/news` and the post's own URL | **Add News** on `/news` or `/admin/news`, or `/admin/content/new?type=post` |
| **Bulletin** | Monthly bulletins, short news blasts, legislative round-ups | `/newsletters` chapter bulletin archive | **New Bulletin** on `/admin/news` |
| **Meeting material** | Agendas, minutes, printable handouts | The meeting-materials section on `/news` | Currently maintained in the site code; ask a maintainer for changes |
| **Page** | A permanent page such as About or a campaign page | Its own route | `/admin/content/new?type=page` |

Do not publish a one-off news item as a new permanent page unless it needs a stable URL that is not part of the news feed. Coded routes such as `/voter-info` are not edited through Pages & Posts.

## Publish a news post

1. Select **Add News** on `/news` or `/admin/news`, or open `/admin/content/new?type=post` directly.
2. Add a title. The slug is generated from it; change the slug only if you need a specific URL.
3. Write a short excerpt. This is the summary shown in news lists and search results.
4. Build the body with the block editor. Add images with alt text when they carry meaning.
5. Use **Preview** to check the draft. A draft has no public page until it is published.
6. Choose **Publish**. If you are not ready, leave it as a draft and return later.
7. Open `/news` and confirm the post appears in the right order.

The editor autosaves and keeps revisions. The **View** action only appears for a published post; a draft shows **Preview** instead.

## Publish a bulletin

1. Go to **Admin → News** or open `/admin/news`.
2. Select **New Bulletin** beside **Add News** in the bulletin manager. The bulletin form is intentionally short; use **Add News** when the update needs a full article.
3. Add the title, date label, short description, topics, and display order.
4. Save it, then open `/newsletters` and confirm it appears in the chapter bulletin archive.
5. Use **Edit** on the bulletin to correct it later. Deletion uses the inline confirmation, not a browser alert.

Bulletins are chapter-owned summaries. They are not the same as a full newsletter PDF or an external chapter's newsletter.

## Ongoing submissions

There is no separate submission queue. A chapter editor can publish directly whenever news is ready:

- Use a post for the full story.
- Use a bulletin when the update is short enough to read as an email blast.
- Anyone can send a chapter news item from the **Submit chapter news** link on `/news`. It opens an email to the chapter inbox with the subject “Chapter news submission”; an editor reviews it and publishes it through the workflow above.
- Send the text and any image to another chapter editor if the author does not have admin access.

Do not create a new account or share an admin login to route around access. Ask an existing admin to verify the person's `profiles.is_admin` flag. The **Submit chapter news** email is a submission route, not an account or a public publishing form.

## Access checklist for an existing admin

- The person can sign in at `/login`.
- Their profile has `is_admin = true`.
- `/admin/news` and `/admin/content/new?type=post` are reachable without a redirect.
- They can see **Add News** and **New Bulletin** after signing in.
- If MFA is required for the account, complete the step-up before trying to publish.

## Pre-publish checklist

- [ ] Title and excerpt are clear without the image.
- [ ] Names, dates, times, and locations are in text.
- [ ] Links open the intended page and use descriptive link text.
- [ ] Images have alt text; no sensitive personal information is visible.
- [ ] The item is the right format (post vs bulletin vs meeting material).
- [ ] Preview looks correct at a narrow width as well as desktop.
- [ ] After publishing, `/news` leads with the item and its link works.

## Failure handling

- **A save fails:** the editor keeps the text on screen and tells you it is not saved. Copy the text before reloading, then retry.
- **A stale-save conflict:** another editor saved first. Reload onto their version, compare the text, and reapply only what is missing.
- **Publish is not visible:** confirm the status is Published, then check `/news` for a post or `/newsletters` for a bulletin. A draft has no public URL.
- **The admin controls are missing:** the account is signed in but is not an admin, or the admin page redirected. Verify the profile flag rather than creating a second account.

## Update the next chapter meeting

The homepage's “Next Community Gathering” card and the public Events page are date-aware. An organizer can put future dates in now and the program will move to the next one without a code change:

1. Open **Admin → Events** (`/admin/events`).
2. Select **Add Event**.
3. Choose **Meetings** and enter the title, date label, time label, location, and RSVP link. Mark the monthly chapter meeting as highlighted.
4. Save, then open `/events` and the homepage. The next future highlighted meeting is announced automatically; past one-off events are omitted from the public list.
5. To correct or remove an event, use **Edit** or **Delete** on the event card. Recurring rows whose date label begins with “Ongoing” or “Every” stay visible after their first occurrence.

The December 1, 2026 meeting is the built-in fallback until a future meeting row is available. It uses the chapter's established monthly time and venue; change the row from `/admin/events` if the meeting details differ.

## Editing other pages

Permanent pages and full articles use the same block editor:

1. Open **Admin → Pages & Posts** (`/admin/content`).
2. Search for the page or post, then select **Edit**.
3. Use **Preview** before publishing. The editor autosaves and keeps revisions.
4. To create a page, use **Add News** for a news post or `/admin/content/new?type=page` for a permanent page.

Do not use the Pages & Posts editor to change coded pages such as `/voter-info`, `/events`, or `/newsletters`; those are maintained in their dedicated admin screens or a deployment. The **How to publish** link on `/news` opens this guide for admins.

## Out of scope

A public, non-admin submission **form** is not implemented. Chapter leadership has not approved one, and the current site deliberately keeps publishing behind admin authentication. The **Submit chapter news** link is intentionally an email route to the existing chapter inbox, with no stored submission record. If leadership wants a form, that needs a separate decision about moderation, spam, notifications, and where the submitted content is stored.
