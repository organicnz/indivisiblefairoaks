# Private family reunification intake

`/ice-alerts/reunification` is a consent-based intake for families and trusted
organizations trying to locate or contact someone in immigration custody. It is
intentionally separate from the public alert feed and map.

## What is never published

- Names, aliases, dates of birth, A-Numbers, or contact details.
- Photos, including the optional private photo.
- Case notes, detention details, or immigration status.
- A public profile, public status page, or map pin for the person.

The tokenized status page shows only the reference code, the status, a volunteer
note, and timestamps. It never shows the person or submitter details.

## Flow

1. A submitter completes the private form and consents to contact and to the
   privacy boundary.
2. `POST /api/ice-reunification` validates the request, rate-limits the IP, and
   optionally stores a JPEG/PNG/WebP photo in the private `ice-reunification`
   bucket.
3. The row is inserted into `public.ice_reunification_requests` with a
   human-readable reference such as `R-7K3M9QP` and a separate UUID status token.
4. The submitter gets a confirmation email with the private status link. The
   chapter inbox gets a reference-only notification; case details are not sent
   by email.
5. A volunteer reviews the request in the Supabase dashboard, verifies it
   against official resources, and updates `status` and `status_note`.
6. The submitter checks the private status page. This is not a public
   verification badge and does not imply release or a court outcome.

## Apply the migration

```bash
supabase db push
```

The migration creates:

- `public.ice_reunification_requests`, with RLS enabled and no public policies.
- A private `ice-reunification` storage bucket limited to JPEG, PNG, and WebP
  files under 4 MB.
- A 90-day `retention_expires_at` default.

`SUPABASE_SECRET_KEY` is required. Without it the form answers 503 instead of
silently failing. `RESEND_API_KEY` is required for confirmation and chapter
notifications; the request is still stored if email delivery fails, and the
submitter is shown the reference and status link so the request is not lost.

## Update a status

Use the Supabase SQL editor or dashboard with the service role. Do not add a
public RLS policy.

```sql
update public.ice_reunification_requests
set status = 'verifying',
    status_note = 'Checking the facility and the date with the official locator.'
where reference_code = 'R-7K3M9QP';
```

Allowed statuses: `received`, `verifying`, `verified`, `closed`.

Keep `status_note` short and non-identifying. It appears on the tokenized status
page: do not put names, photos, A-Numbers, or case details in it.

## Photo access

The bucket is private. Use the Supabase dashboard's storage browser to create a
short-lived signed URL when a volunteer needs to view a photo. Do not copy the
object into public media, email, chat, or the website.

## Retention

`retention_expires_at` defaults to 90 days after intake. The
`POST /api/ice-reunification/purge` route deletes expired rows and their private
photos. It requires the same `CRON_SECRET` bearer token as the surge notifier:

```bash
curl -X POST https://indivisiblefairoaks.org/api/ice-reunification/purge \
  -H "Authorization: Bearer $CRON_SECRET"
```

Schedule it daily (for example from `pg_cron` + `pg_net`, or an external
scheduler). Deleting a database row alone does not delete the object in Storage,
so always remove the photo objects first.

## Verification checklist

- Confirm the migration and private bucket exist in the target project.
- Set `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, and `ADMIN_ORDER_EMAIL`.
- Submit one test request and confirm the email, status page, and database row.
- Update the row to `verifying` and confirm the status page changes without
  exposing case details.
- Confirm a signed-out visitor cannot query the table or bucket.
- Delete the test row and its photo.
