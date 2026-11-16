# Public ICE report intake: threat model and launch checklist

**Status: implemented with engineering controls; legal launch gate remains open.**
The current site now has a text-only private intake (`/ice-alerts/report`), a
service-role-only raw table, a separate sanitized public projection, and a
two-person database-enforced publication path (`/admin/ice-reports`). This
implementation does not substitute for counsel, board approval, a data map, or
the launch checklist below. Attachments, reporter accounts, and automated
publication remain out of scope.

**This is threat modeling, not legal advice.** Every legal question below needs
review by counsel licensed in the relevant jurisdiction. The chapter should not
launch a public report intake on the strength of this document alone.

## 1. Executive judgment

This is not a generic contact form. A public intake for reports of ICE
enforcement activity creates a safety-critical record about:

- the person reporting, who may be undocumented, a neighbor, a worker, a
  witness, or a targeted person;
- people visible or described in the report, who did not choose to be in it;
- a time and place where enforcement may be occurring; and
- potentially images, video, audio, documents, or screenshots supplied by a
  stranger.

The public alert is the least sensitive part of the system. The dangerous data
is the **raw report, the attachment, the reporter's contact details, the network
metadata, and the moderation record**. Those are the records that can identify a
reporter to immigration authorities, a stalker, an employer, or a litigant, and
they are the records most likely to be demanded in a legal request.

The safest credible version of this feature is deliberately narrow:

1. **Text-only at launch.** No public attachments until quarantine, scanning,
   redaction, and retention are working and tested.
2. **Report the event, never the person.** No subject names, faces, plates,
   addresses, immigration status, employer, school, or social handles.
3. **City-level publication only.** The private record may hold a little more
   detail for verification; the public projection holds only a coarse time,
   city/state, category, and a short human-written summary.
4. **Anonymous or minimal-contact intake.** No account required. Contact details
   optional and clearly labeled as a risk. Never promise anonymity unless the
   entire path, including edge logs, email, and backups, is engineered for it.
5. **Human review before publication.** Two-person approval for anything that
   reaches the public map. No automatic publishing, no automatic "confirmed"
   label, no automatic surge notification.
6. **Short retention and a real deletion path.** Raw reports, contact details,
   and originals should disappear on a schedule; the public projection can
   outlive them only as a sanitized, non-identifying record.
7. **A private, separately scoped store.** The raw intake must not share a
   public bucket, a public RLS policy, or a client-accessible table with the
   public feed.

If the product cannot accept those limits, it is not a report intake with a
privacy boundary; it is a surveillance log with a form on top. That is a
different risk decision and needs the chapter's board, counsel, and insurer,
not only an engineering review.

### Top risks, in order

| Rank | Risk | Why it is existential |
|---:|---|---|
| 1 | Raw reports or attachments become public through a bucket, RLS, signed-URL, cache, or code mistake | Can identify reporters, subjects, and bystanders; enables retaliation and immigration enforcement |
| 2 | A legal request reaches a store with years of identifiable reports | The chapter cannot protect people it cannot truthfully say it does not hold |
| 3 | A report is published with an exact address, face, plate, or name | Doxxing, stalking, harassment, wrongful identification, or obstruction |
| 4 | A malicious or false report is amplified before review | Diverts people, harms a business or individual, and destroys trust in the map |
| 5 | A moderator account or service-role key is compromised | Attacker can read, alter, publish, or delete the entire intake |
| 6 | CSAM, credible threats, or graphic content is uploaded | Legal reporting duties, moderator harm, and evidence-handling obligations |
| 7 | Retention and deletion fail silently | Data lives in backups, logs, email, or orphaned objects far beyond the stated policy |

## 2. Current-system context

The design should reuse the project's existing safety patterns where they fit,
and explicitly compensate where they do not.

| Current fact | Implication for report intake |
|---|---|
| `/ice-alerts` now links to a **private chapter intake** (`/ice-alerts/report`) and the national Stop ICE Alerts Network (`RapidResponseGuide.tsx`). The old "this page does not collect reports" promise was deliberately replaced with review-before-publication copy and a privacy disclosure. | Keep the distinction between private raw intake, sanitized two-person publication, and the independent national network visible in every channel. |
| The public feed keeps only city centroids and generated summaries; raw comments, street addresses, plates, media URLs, and names are dropped in `ice-rapid-feed.ts` | This is the right publication model. Use the same allowlist discipline for the new public projection. |
| The private reunification intake uses RLS with **no** public policies, a private bucket, a 90-day retention default, and signed URL access (`docs/ice-reunification.md`) | A useful precedent, but report intake is more adversarial and more publicly visible. Reuse the isolation and retention pattern; do not assume the reunification threat level is sufficient. |
| `src/lib/rate-limit.ts` is an **in-memory, per-isolate** limiter | Not sufficient for a public report form. A serverless deployment gives an attacker many buckets. Add durable global limits and platform WAF controls. |
| `src/lib/ice-alert-proof.ts` provides a short-lived, IP-bound proof-of-work challenge | Useful as one anti-automation layer, but not a substitute for durable rate limits, moderation, or content controls. It also requires care not to promise anonymity. |
| The existing privacy policy covers contact messages, accounts, analytics, and providers, but not public incident reports | The policy must describe report intake, sensitive categories, publication, retention, legal requests, and the limits of anonymity before the form goes live. |
| `SUPABASE_SECRET_KEY` bypasses RLS and is used for server-side operations | A single key compromise can expose every table. The raw intake should have its own project or, at minimum, its own tightly scoped service path and audited use. |
| The site already publishes safety language: do not approach or obstruct enforcement; no names, faces, plates, or immigration status (`src/components/ice-alerts/RapidResponseGuide.tsx`) | Keep that posture. Intake must not become a tool for users to identify, follow, or confront anyone. |
| `AGENTS.md` requires RLS on user-facing tables, migration review, and server-only secrets | Report intake must follow those rules, plus stronger isolation because the content is high-risk. |

## 3. Scope, assumptions, and decisions that change the model

### In scope

- A public form for a suspected enforcement sighting, checkpoint, or detention
  activity.
- Optional reporter contact details and optional private follow-up.
- Optional private attachments, if the launch gate permits them.
- Triage, verification, redaction, publication, correction, and deletion.
- Public display of a sanitized report or alert, if the product includes one.
- Legal requests, retention, incident response, and moderator operations.

### Out of scope

- The existing private family-reunification intake. It has separate consent,
  retention, and legal handling; do not merge the datasets.
- Emergency dispatch, legal advice, immigration case management, or bond/fee
  processing.
- A public comment thread, user profiles, leaderboards, or reporter identities.
- Automated enforcement-action claims or real-time tracking of individuals.

### Assumptions to confirm before design approval

| Decision | Safe default | Why it matters |
|---|---|---|
| Are reports published? | Yes, only as a sanitized city-level projection after review | A private-only intake has a smaller audience but still holds dangerous data |
| Are attachments accepted? | No at launch; phase 2 if needed | Attachments add malware, CSAM, metadata, redaction, and evidence-handling risk |
| Is anonymity promised? | "We minimize and limit retention; we cannot promise technical anonymity" | Edge, email, and provider logs may identify a reporter; an absolute promise would be false |
| Is reporter contact required? | No; optional | An email address can identify a person and is discoverable |
| Who moderates? | Trained volunteers plus a named accountable staff/lead role | Untrained moderation creates safety and legal failures |
| Who can publish? | Two authorized people for every public item | One compromised or mistaken reviewer should not be able to publish |
| Is the chapter the data controller? | Confirm with counsel | Determines notices, requests, and vendor terms |
| Where is data stored? | Confirm Supabase region and subprocessors | Affects legal requests, breach notification, and vendor access |
| How long is raw data kept? | Shortest operationally defensible period | Retention is the single largest legal-request exposure |
| Is data shared with Stop ICE or other partners? | No by default; if yes, a written data-sharing agreement and consent | Sharing multiplies copies, subpoena targets, and re-identification risk |

If any of these defaults changes, the threat model must be revisited before
implementation.

## 4. Assets, actors, and trust boundaries

### Assets and sensitivity

| Asset | Examples | Sensitivity | Public? |
|---|---|---|---|
| Reporter identity | Email, phone, name, account, receipt token | **Critical** | Never |
| Reporter network metadata | IP, user agent, approximate location, email provider headers | **High** | Never |
| Subject identifiers | Name, face, plate, address, A-Number, immigration status, employer, school | **Critical; generally prohibited** | Never |
| Precise location | Street address, intersection, GPS, map pin, landmark | **High** | Never; city only |
| Event detail | Time, category, short description, direction of travel | Medium–high | Only sanitized and generalized |
| Attachments | Photo, video, audio, screenshot, document | **Critical** | No at launch; only sanitized derivative if ever |
| Moderation record | Notes, flags, reviewer identity, rationale, edit history | **High** | Internal only; audit access |
| Public projection | City, state, coarse time, category, generic summary | Low–medium | Yes, after approval |
| Audit/access logs | Who viewed, edited, published, exported, deleted | **High** (reveals interest and sources) | Never public |
| Credentials and keys | Service role, signing secret, moderator sessions | **Critical** | Never |

### Actors and motivations

| Actor | Capability | Likely motive |
|---|---|---|
| Safety-seeking reporter | Mobile browser, local knowledge, may be frightened | Warn neighbors, protect family |
| Malicious reporter | Can submit repeatedly, fuzz fields, upload files | Harass a person or business, divert attention, test defenses |
| Coordinated group | Many identities, scripts, shared targets | Manufacture a surge, drown moderation, discredit the map |
| Subject or bystander | May be visible in media; may request removal | Privacy, safety, reputation |
| Stalker/harasser | Knows a target; may watch the map | Locate, identify, intimidate |
| Data broker/scraper | Automated collection of public and leaked data | Resale, enrichment |
| Immigration enforcement | Legal process, subpoena, administrative demand, vendor request | Identify reporters or subjects |
| Civil litigant | Discovery, subpoena, public records attempts | Build a case against a person or the chapter |
| Journalist/researcher | Public sources, interviews, archive requests | Story, verification |
| Insider moderator | Legitimate access | Curiosity, conflict, coercion, leak, sabotage |
| Compromised admin | Session theft, phishing | Mass read, publish, delete, or export |
| Vendor employee | Infrastructure access | Error, coercion, breach |
| External attacker | DDoS, credential stuffing, exploit, social engineering | Disruption, notoriety, data theft |

### Trust boundaries

1. **Browser → edge/app.** All input is hostile. The browser's MIME type, file
   size, GPS, and "safe" claims are advisory only.
2. **App → private database.** The service credential bypasses RLS. A bug here
   is a full-data bug, not a UI bug.
3. **App → attachment quarantine.** Uploaded bytes are untrusted executable
   content even when they claim to be an image.
4. **Storage → moderator.** A signed URL is a bearer capability. It can be
   copied, logged, cached, or forwarded.
5. **Moderation → public projection.** This is the most important policy gate:
   raw fields must not flow through by accident.
6. **Public projection → CDN/browser.** Caching, indexing, and social previews
   can make a private mistake permanent.
7. **App → email/analytics/error monitoring.** Third parties can receive PII in
   message bodies, URLs, headers, or breadcrumbs.
8. **Organization → legal requester.** A request can arrive at any inbox,
   volunteer, vendor, or personal device.
9. **Backups and vendors.** Deletion from the live table is not deletion from
   every copy.

### Data flow, including shadow copies

**Intended flow:** form → validation and anti-abuse → private raw row →
quarantine object (if enabled) → triage → redaction and verification →
second-person approval → sanitized public projection → cache/CDN → public map.
Retention worker deletes raw rows and objects; a legal hold can stop deletion.

**Shadow flows that must be designed, not ignored:** Vercel request logs,
Supabase logs and backups, email provider message storage, Sentry breadcrumbs,
PostHog events (disable on the form), browser autofill and local storage,
moderator screenshots and downloads, support/ops chat, incident exports, and
any vendor's support access.

## 5. Non-negotiable safety invariants

These are design gates. If an implementation cannot demonstrate one, it does not
ship.

1. **No public path to raw intake.** No anon/authenticated grants, no public
   bucket, no direct client table reads.
2. **The public projection is an allowlist.** It is built from a dedicated
   view/table/DTO containing only approved fields; it is never a `select *` from
   the raw table with a UI filter.
3. **No automatic publication.** A human decision, recorded with reviewer and
   timestamp, precedes every public item.
4. **No identity, face, plate, address, or immigration status in public.**
   Prohibited fields are rejected at intake or removed before storage; they are
   never "hidden in the UI."
5. **Attachments are quarantined and scanned.** No inline preview of unscanned
   bytes; no SVG, HTML, PDF, archive, or executable formats; no public bucket.
6. **No raw PII in logs, analytics, error reports, or email bodies.** Logs use
   report IDs and state transitions, not content.
7. **Retention is executable and monitored.** Every raw record has an expiry;
   a purge job deletes objects and rows; failures alert an owner.
8. **Legal hold overrides deletion.** A held record cannot be purged by the
   normal worker, and the hold is logged.
9. **Two-person publication.** One person may draft; a second, authorized person
   approves the public projection.
10. **Access to raw records is audited.** Viewing, revealing, exporting, and
    deleting are recorded; broad exports are not available to ordinary
    moderators.
11. **No anonymity claim unless earned end-to-end.** The public copy says what
    is minimized and what may still be retained; it does not promise that no one
    can ever identify a reporter.
12. **No dispatch or enforcement integration.** The intake does not call police
    or ICE, does not promise a response, and repeats the 911/emergency boundary.

## 6. Threat model: abuse and integrity

Abuse is not only spam. The worst abuse is a report that looks credible enough to
be published and causes a person, business, or neighborhood to be targeted. The
intake must assume that some submitters are lying, coordinating, testing the
moderators, or trying to make the map itself a weapon.

| ID | Abuse case | Impact | Required controls | Residual risk |
|---|---|---|---|---|
| A1 | Bot flood creates thousands of drafts, emails, and attachments | Queue collapse, cost, hidden real reports | Durable global/per-IP/per-email limits; proof-of-work or privacy-reviewed CAPTCHA; honeypot; request and upload caps; queue backpressure; no email until accepted | Distributed low-and-slow traffic can still consume capacity |
| A2 | One person submits many reports to manufacture a "surge" | False alert, diversion, credibility loss | Deduplicate by normalized event fingerprint; velocity limits; do not compute public surges from unreviewed reports; cap per reporter/network; moderation | A determined actor with many networks can still create noise |
| A3 | Coordinated group brigades a location or business | Harassment, economic harm, false enforcement claim | Corroboration policy; trust tiers; no automatic publish; source diversity checks; block coordinated fingerprints; review all media | Coordination is hard to prove; avoid treating shared language or Spanish as suspicious |
| A4 | Report is really a doxxing attempt against a named person, home, employer, or school | Stalking, retaliation, deportation, violence | Do not provide subject-name/address/status fields; reject prohibited content; automated detection plus human review; preserve evidence but do not publish | A determined submitter can describe a person without labels; reviewers need training |
| A5 | Swatting or false emergency | Armed response, injury, death | No dispatch integration; city-level only; delay publication; emergency copy says call 911; escalate threats to counsel/leadership; never send a location to police as a "tip" without a documented emergency decision | The chapter cannot control what readers do with a public post |
| A6 | Link spam, phishing, tracking pixels, or malware disguised as a "source" | Malware, reporter/reader deanonymization | Strip links from public copy; do not fetch arbitrary URLs server-side; quarantine attachments; warn about external links; no clickable user URLs in email | A screenshot can contain a malicious QR code; human review still needed |
| A7 | Enumeration of receipt/status tokens | Read another person's report/status | High-entropy tokens; rate-limit lookups; no sequential IDs; no listing endpoint; uniform not-found responses; audit repeated failures | A leaked or forwarded link is a bearer capability |
| A8 | Cross-site request forgery or open CORS | Third-party sites file reports as a visitor | Same-origin checks; Origin/Sec-Fetch-Site validation; CSRF token or strict JSON content type; no wildcard CORS; no credentials on public POST | Browser extensions and malicious local software remain outside the boundary |
| A9 | Resource exhaustion: huge text, decompression bomb, huge image, long video | Outage, memory exhaustion, cost, queue poisoning | Strict body limits while streaming; pixel/duration/frame caps; decode timeouts; worker memory limits; reject multi-page/animated formats; queue quotas | Provider-level request limits are not a content policy |
| A10 | Attacker takes over a moderator account | Mass publish, delete, export, or leak | MFA/SSO; short sessions; device/session review; anomaly alerts; least privilege; two-person publish; no bulk export; access revocation | A live session on an infected device can still act as the moderator |
| A11 | Insider curiosity, conflict, or coercion | Unauthorized reading, screenshot, leak | Need-to-know roles; reveal-on-demand; audit every reveal; no personal devices if possible; confidentiality agreement; conflict recusal; canary records; offboarding | Screenshots and memory cannot be prevented |
| A12 | DDoS or application-layer flood | Intake and public map unavailable during an enforcement event | WAF/edge rate controls; queue; static fallback with 911/legal resources and an alternate trusted network; status communication; no false success | A sustained attack can still force degraded service |
| A13 | Reporter uses the form to threaten or harass volunteers | Moderator safety, legal exposure | Prohibited-content policy; route threats to a safety lead; do not reply from personal accounts; preserve evidence; law-enforcement decision by counsel | Volunteers may still be targeted by someone who knows them |
| A14 | Impersonation of a trusted partner or official source | Undue credibility, false "verified" label | No trust based on email domain or self-claimed affiliation; partner verification through a separate channel; label all unsolicited reports as unverified | A convincing liar can still fool a tired reviewer |
| A15 | Duplicate/replayed submissions after a timeout | Duplicate emails, duplicate public items, inconsistent state | Idempotency key per form attempt; server-side dedupe; visible receipt token; no automatic retry that creates a second report | A user may intentionally submit a corrected duplicate |
| A16 | AI-generated or manipulated image/video | False evidence, defamation, wasted review | Provenance labels; no automatic verification; compare with independent reports; reject if authenticity cannot be assessed; never present as confirmed | Detection is imperfect and should not be the sole gate |
| A17 | Weaponized correction/takedown request | Suppress true safety information or expose a reporter | Verify requester authority; do not reveal reporter identity; preserve audit; counsel review for legal demands; emergency removal only with documented safety reason | A legitimate subject may still be unable to prove harm quickly |
| A18 | Public map is scraped and combined with other data | Mosaic re-identification of a place or person | City-level coordinates; coarse time; no raw media; no exact addresses; consider aggregation thresholds; rate-limit feed; monitor scraping | Public data can always be copied; minimization is the only durable control |

### Abuse design rules

- **Rate limits must be global and durable.** The current in-memory limiter is a
  useful first line but cannot be the only line. Use a database-backed or edge
  counter with per-IP, per-email (if provided), per-network, and global caps;
  fail closed for writes when the limiter is unavailable, while keeping the
  public safety page available.
- **Do not require an account to report.** Requiring an account excludes the
  people most at risk and creates another identity store to subpoena. If abuse
  demands stronger identity, use risk-based friction, not mandatory accounts.
- **Do not use IP geolocation as a truth test.** It is inaccurate, privacy-
  invasive, and punishes people using shelters, libraries, VPNs, or mobile
  networks. Use it only as one weak signal, never as proof the report is false.
- **Do not auto-publish based on volume.** Multiple reports are not independent
  evidence; they may be one campaign. Human review is required before a public
  item or surge label.
- **Separate submission from publication.** A successful POST means "received,"
  not "published," "verified," or "help is coming." The UI must say that.
- **Keep an abuse evidence path.** Threats, CSAM, coordinated campaigns, and
  legal requests may require preserved evidence. Preserve only under a hold and
  only for the minimum necessary, with restricted access.

## 7. Threat model: moderation

Moderation is the safety control that turns hostile input into a limited public
fact. It is also a new insider-risk surface and a human-trauma surface.

| ID | Moderation failure | Impact | Required controls |
|---|---|---|---|
| M1 | One reviewer publishes a report with an exact address, face, or plate | Doxxing, retaliation, loss of trust | Two-person publish; public-projection preview; redaction checklist; second reviewer sees the exact public output, not just the draft |
| M2 | Reviewer has a conflict of interest (friend, employer, target, local business) | Biased rejection or publication | Written recusal rule; conflict declaration; reassignment; audit of decisions |
| M3 | Reviewer over-trusts a source's "confirmed" label or an AI score | False alert presented as verified | No "confirmed" badge at launch; defined evidence tiers; reviewer records the basis; periodic QA sample |
| M4 | Inconsistent decisions across reviewers | Perceived bias, legal risk, community harm | Written rubric with examples; training; calibration exercises; appeal path; decision log |
| M5 | Queue backlog makes an old report look current | People go to the wrong place; stale alert harms trust | Explicit age labels; auto-expiry; no publication of stale items as active; capacity alerts; ability to pause intake |
| M6 | Moderator is exposed to graphic violence, threats, or CSAM | Trauma, turnover, unsafe handling | Rotation; no sole exposure; clear stop-and-escalate protocol; counseling/EAP; restricted CSAM access; do not require viewing to "verify" |
| M7 | Moderator screenshots or downloads raw media | Leak, re-victimization | No bulk download; watermark; download audit; device policy; confidentiality agreement; small need-to-know group |
| M8 | No correction/appeal path | A wrong report stays public; subject has no remedy | Public correction/removal contact; documented review; visible correction note; emergency removal; time-bound response |
| M9 | Moderator is doxxed or harassed | Personal safety, chilling effect | Pseudonymous moderator identities; no personal contact in UI; secure comms; threat response; remove public-facing attribution |
| M10 | Access survives departure or role change | Retaliatory or accidental access | Offboarding checklist; immediate revocation; quarterly access review; session invalidation; audit |
| M11 | Moderation notes become a second PII store | Broader legal exposure | Notes are structured, short, and non-identifying where possible; separate retention; never copy raw media into notes |
| M12 | AI/automation silently rejects marginalized-language reports | Censorship and safety harm | Human review for ambiguous cases; no language-based auto-reject; appeal; test with Spanish and mixed-language examples; vendor bias review |

### Minimum moderation workflow

1. **Received.** Private record created; receipt returned. No public action.
2. **Triage.** Check for immediate threats, CSAM, doxxing, and obvious spam.
   Safety escalation if needed. Do not contact law enforcement automatically.
3. **Verify.** Compare structured fields and any independent reports; check
   location at city level; document the basis. Never ask the reporter to obtain
   more identifying information about a subject.
4. **Redact.** Remove names, plates, faces, addresses, immigration status,
   medical details, minors, and anything that identifies a bystander. Build the
   public projection from scratch.
5. **Second review.** A different authorized person compares the public preview
   against the prohibited-content checklist and approves or returns it.
6. **Publish.** Only the sanitized projection reaches the public table/view.
   Coarse time and city only. Add the unverified-community label.
7. **Monitor/correct.** Watch for harm reports and errors; correct or remove
   promptly; record the reason.
8. **Close and expire.** Delete raw data on schedule unless a legal hold applies.

### Moderation authority and separation of duties

- **Intake triager:** can read a report, mark spam/threat, and route it. Cannot
  publish or delete evidence.
- **Verifier:** can research and propose a public summary. Cannot approve their
  own proposal.
- **Publisher:** can approve the final public projection. A second publisher is
  required for any item containing media, a named place of worship, a school,
  a shelter, a medical facility, or a report about a specific business.
- **Safety/legal lead:** can place a hold, remove an item, and handle legal
  requests. Does not unilaterally publish.
- **Administrator:** manages accounts and configuration. Should not be a routine
  content reviewer.

All roles require MFA, a named person, and a documented grant. Shared moderator
accounts are prohibited.

## 8. Threat model: PII and re-identification

### 8.1 Data classification and default handling

| Class | Data | Default handling | Public projection |
|---|---|---|---|
| **Public** | City/state, category, coarse time window, human-written generic summary, unverified label | Allowed after two-person approval | Yes |
| **Internal restricted** | Raw narrative, precise place or landmark, private media, moderation notes, verification basis | Encrypted at rest; need-to-know; audited access; short retention | No |
| **Highly restricted** | Reporter name/email/phone, IP/device metadata, subject name/face/plate/A-Number/immigration status, minors, medical information, threats/CSAM evidence | Avoid collection if possible; extra encryption/access controls; legal hold aware; shortest retention | Never |

### 8.2 PII threat cases

| ID | PII threat | Impact | Required controls |
|---|---|---|---|
| P1 | Reporter email or phone identifies them to an employer, abuser, or immigration authority | Retaliation, detention, violence | Contact optional; no account; plain-language warning; short retention; field-level encryption; access audit; no marketing use; no sharing with partners without explicit consent |
| P2 | Reporter IP/device metadata is retained indefinitely in logs or analytics | Deanonymization, legal exposure | HMAC IP for rate limiting with rotating salt; no raw IP in application DB; disable analytics/session replay on the form; scrub provider logs where configurable; document what vendors still see |
| P3 | Subject is named or identifiable through face, plate, address, tattoo, workplace, school, or a combination | Stalking, deportation, violence, wrongful accusation | Prohibited fields; redaction; no public media; do not ask for immigration status; reject reports that target a person rather than an event |
| P4 | Precise location is published | Enables tracking, confrontation, obstruction | City-level only; no street address, intersection, map pin, or exact coordinates; fuzz/round any private location; warn reporters not to include addresses in free text |
| P5 | Free-text narrative contains names, addresses, medical details, or status | Uncontrolled PII, legal exposure | Short max length; field-specific prompts; prohibited-content guidance; automated suggestion plus human review; redact before storage where possible; never copy raw text to public |
| P6 | Mosaic effect: several city/time/category reports identify a small place or person | Re-identification despite no direct identifier | Coarse time; city-level; aggregation thresholds; avoid publishing repeated reports about the same small area; consider suppressing low-population locations; do not expose report counts by neighborhood |
| P7 | Image/document metadata contains GPS, device serial, author name, or a thumbnail | Deanonymization, location leak | Strip EXIF/XMP/IPTC and all metadata by re-encoding; remove embedded thumbnails; never publish an original; scan screenshots for visible notifications, names, addresses, and account avatars |
| P8 | Screenshots include third-party notifications, contacts, or private messages | Exposes uninvolved people | Human review; redact; reject if consent/identity cannot be protected; no automatic OCR into logs |
| P9 | Minors appear in media or are described | Child safety, CSAM, legal duties | Do not publish; blur/redact; if CSAM suspected, stop, preserve, restrict access, and follow counsel-approved reporting protocol |
| P10 | Reporter is identifiable from a unique writing style, language, or local detail | Re-identification even after names removed | Paraphrase public summaries; do not quote raw reports; remove unique details; have a second reviewer check for mosaic clues |
| P11 | Moderation notes or access logs reveal who is interested in a report | Insider leak, legal inference | Separate notes store; access audit; no broad query access; retention limit; redact notes before any external production |
| P12 | Data is copied into email, Sentry, PostHog, chat, or screenshots | Shadow copies outside the retention boundary | No PII in email bodies; scrub Sentry `beforeSend`; disable PostHog autocapture on intake; no raw content in chat/support tickets; use IDs and links to the controlled UI |
| P13 | Deletion request is used to identify or phish a reporter | Further exposure | Verify with the receipt token or a controlled email challenge; do not ask for new identity documents; uniform responses; log without content |
| P14 | Backup or replica retains deleted PII | Broken deletion promise, legal exposure | Document provider backup windows; use tombstone + restore tests; do not claim immediate deletion from backups; age out backups; include backups in the data map |

### 8.3 PII minimization rules for the form

Use structured fields rather than one large narrative:

- **Required:** city/state (select from known cities), category (enforcement /
  checkpoint / detention / other), approximate time window, and a short
  description of what was observed.
- **Optional:** direction of travel at a **city/neighborhood** level, number of
  vehicles/people only if non-identifying, and a safe contact method.
- **Prohibited:** names, initials, dates of birth, A-Numbers, immigration
  status, home/work/school addresses, plates, officer names, social handles,
  medical information, and allegations about a specific person's identity.
- **Do not ask:** "Who is it?", "Where do they live?", "What is their status?",
  or "Upload a photo of the person." The form's job is an event, not a profile.
- **Warn:** the description may be retained and reviewed by volunteers; do not
  include information you would not want an adversary to read.
- **Do not promise anonymity.** Say: "We minimize what we collect and limit
  access. We cannot guarantee that no one can ever identify a reporter." If the
  project wants a stronger claim, it must remove contact fields, avoid email,
  control edge logs, support Tor, and have counsel review the claim.

### 8.4 Access and encryption controls

- TLS everywhere; encryption at rest from the provider; application-level
  encryption for reporter contact details and any private subject identifiers.
- Keep encryption keys outside the database project and outside the repository;
  restrict decrypt access to a named role; rotate with a documented procedure.
- Hash IPs with an HMAC and a rotating salt. Keep the salt separate from the
  report store. Do not keep raw IPs in application logs.
- Use role-based access: triager, verifier, publisher, safety/legal, admin.
  MFA is mandatory; shared accounts are forbidden; sessions expire quickly.
- Log every read of a highly restricted record, every reveal of a full
  attachment, every export, and every deletion. Do not log the content.
- Forbid bulk export for ordinary moderators. If an export is necessary, make
  it a time-limited, approved, watermarked action with a second approver.
- Separate production from development. Never copy real reports into staging,
  test fixtures, screenshots, or demos. Use synthetic data with realistic
  edge cases.

## 9. Threat model: attachments

### 9.1 Recommendation

**Do not accept public attachments at launch.** Text-only intake removes the
largest cluster of legal, safety, and operational risks. If media is essential
to the product, launch it only after the pipeline below is implemented, tested,
and staffed. A photo of a person is not a neutral attachment; it is the most
likely path to a serious harm event.

### 9.2 Threat cases

| ID | Attachment threat | Impact | Required controls |
|---|---|---|---|
| F1 | Malware, exploit, or polyglot file disguised as an image | Server compromise, reviewer device compromise | Magic-byte validation; decode in a sandbox; re-encode; malware scan; no raw file execution; no SVG/HTML/PDF/ZIP/executables |
| F2 | Decompression bomb, huge dimensions, animated frames, long video | Memory/CPU exhaustion, outage | Pixel/frame/duration caps; streaming size cap; decode timeout; worker memory limit; reject animated/multi-page; queue quota |
| F3 | EXIF/GPS/device metadata or embedded thumbnail | Reporter location/device leak | Strip all metadata; re-encode from pixels; strip embedded thumbnails; verify with a metadata reader in tests |
| F4 | Face, plate, address, uniform name tag, or bystander in the image | Doxxing, retaliation, wrongful identification | Blur faces/plates/name tags; crop; reject if redaction is uncertain; public derivative only, never original |
| F5 | CSAM or suspected CSAM | Severe legal and human harm | Hash-matching/scanning where counsel approves; immediate quarantine; restrict to a trained safety lead; do not redistribute; preserve for authorities per counsel; mandatory-reporting analysis |
| F6 | Credible threat, graphic violence, or terrorist content | Moderator harm, legal duties | Stop review; safety escalation; restricted access; law-enforcement decision by counsel; do not publish |
| F7 | Screenshot contains private messages, contacts, notifications, or account identity | Exposes uninvolved people | Human review; redact; reject if cannot sanitize; OCR only in a private, short-lived process |
| F8 | Copyright, consent, or recording-law problem | Takedown, liability | Uploader attestation; limited license for moderation; no public media at launch; counsel-reviewed notice/takedown process; do not publish audio without advice |
| F9 | Direct-to-storage upload is abused to fill the bucket | Cost/outage | Per-draft signed upload token; short TTL; size/type caps; path bound to draft; quota; orphan cleanup; no public bucket |
| F10 | Signed URL is logged, cached, forwarded, or indexed | Unauthorized viewing | Short TTL; `no-store`; no third-party assets; bind to authenticated moderator; audit issuance; proxy through an authorized route if possible |
| F11 | Partial upload/DB failure leaves an orphan object | Hidden retention/privacy leak | Upload to quarantine first; insert row; compensating delete on failure; periodic orphan scan; object-first deletion |
| F12 | Public thumbnail or CDN cache survives deletion | Permanent leak | Private bucket only; no public CDN; signed/proxied access; cache-control private/no-store; purge derived thumbnails with original |
| F13 | AI-generated or manipulated media is treated as evidence | False public claim, defamation | Provenance label; no automatic verification; independent corroboration; reject if authenticity cannot be assessed; never say "verified" |
| F14 | Audio reveals voices, names, locations, or is recorded illegally | Privacy/legal harm | Do not accept audio at launch; if later, counsel review, redaction, consent, and no public audio |
| F15 | Video reveals a continuous location or a person's face for many frames | Tracking, doxxing | Do not accept video at launch; later: transcode, strip metadata, sample/blur, duration/location limits, human frame-by-frame review |

### 9.3 Attachment pipeline (only if the media gate is approved)

1. **Preflight:** allowlist JPEG/PNG/WebP only; max 4 MB and a pixel cap;
   reject animated, multi-page, SVG, PDF, ZIP, and executables. Client checks
   are convenience, not trust.
2. **Receive:** enforce a streaming byte cap and a timeout; do not trust
   `Content-Type`; read magic bytes.
3. **Quarantine:** random object key, private bucket, no public URL, no inline
   preview; write a row with status `quarantined`, hash, and size.
4. **Sanitize:** decode in an isolated worker; cap pixels; re-encode from pixels
   to a new file; strip all metadata; generate a sanitized preview. Never keep
   the original as the review asset.
5. **Scan:** malware scan and, where counsel approves, CSAM hash matching. Do
   not use an unapproved third-party scanner that retains the file.
6. **Human review:** verify faces/plates/addresses/screenshots; blur/crop;
   reject if uncertain. Record the reviewer and the edits.
7. **Second review:** compare the exact public derivative, not the original.
8. **Publish:** only if policy permits a sanitized image. Serve through a
   controlled route or short-lived signed URL; `no-store`; `nosniff`; no index;
   no social preview.
9. **Retain/delete:** delete the original and quarantine copy on a short
   schedule; keep only the approved derivative if necessary; legal hold can
   preserve the original in restricted storage.
10. **Audit:** record upload, scan result, review, publication, access, and
    deletion by ID and actor. Never put the object bytes in logs.

## 10. Threat model: retention and deletion

### 10.1 Proposed retention defaults

These are starting points for counsel and the chapter owner, not a legal
opinion. Shorter is safer when the data is not needed. Every period must be
reflected in the privacy notice and in an executable job.

| Data | Default | Trigger | Notes |
|---|---:|---|---|
| Raw report (text, contact, private location) | 30 days | Final moderation decision | Rejected items can be deleted sooner, e.g. 7 days |
| Original/quarantine attachment | 7 days after sanitized derivative, or 30 days maximum | Review complete | Never retain an original just because it is easier |
| Sanitized public record | 90 days | Publication | After that, keep aggregate counts only if policy allows |
| Reporter contact | 30 days after closure | Closure or withdrawal | Delete earlier if no follow-up is needed |
| Moderation notes | 1 year | Closure | IDs/actions/rationale; no raw media or unnecessary PII |
| Access/audit log | 90 days–1 year | Event | Must be long enough for investigations, short enough to limit inference |
| Email provider copies | Provider default, minimized | Send | Do not put report content in email |
| Backups | Provider window, documented | Provider schedule | Deletion from primary is not immediate deletion from backups |
| Legal hold | Until written release | Hold | Overrides every normal deletion window |

### 10.2 Retention threat cases

| ID | Threat | Impact | Controls |
|---|---|---|---|
| R1 | Raw reports are kept "just in case" for years | Huge legal-request and breach exposure | Per-record expiry; dashboard showing age; monthly retention report; owner sign-off for any extension |
| R2 | Purge runs too early and deletes a live safety/legal record | Loss of evidence, failure to help | Hold flag; grace period; dry-run counts; two-phase delete; backup until hold review |
| R3 | Deletion removes the row but not the object, thumbnail, email, or backup | False deletion promise | Object-first deletion; derived-object list; provider deletion procedure; backup expiry; restore test |
| R4 | Legal hold is placed after the purge starts | Spoliation, legal risk | Hold check in the same transaction/claim; pause worker on hold; log race; manual review of borderline records |
| R5 | Orphan objects from failed uploads remain forever | Hidden PII, cost | Quarantine ledger; orphan scan; daily reconciliation; delete unlinked objects |
| R6 | Logs and analytics outlive the record | Reporter identification after deletion | Log only IDs; scrub vendor data; retention on logs; disable analytics on the form |
| R7 | Third parties (email, CAPTCHA, scanner, vendor support) keep copies | Data outside the chapter's control | DPA/subprocessor review; data minimization; no content in email; vendor retention terms; regional review |
| R8 | Deletion requester is not verified, or verification collects more PII | Wrong deletion or new exposure | Receipt token or controlled email challenge; do not request ID documents; uniform response; legal-hold exception |
| R9 | Public cache/search index keeps a removed report | Permanent harm | `no-store` for private; purge CDN; request search removal; correction page; monitor |
| R10 | Backup restore reintroduces deleted data into production | Privacy incident | Tombstone table; restore runbook; re-apply deletions and holds after restore; test in staging |
| R11 | Retention policy is not disclosed consistently | Trust and legal risk | Privacy notice, form copy, internal schedule, and job config all agree; audit for drift |
| R12 | Legal hold is never released | Over-retention forever | Hold owner, review date, release approval, annual audit |

### 10.3 Deletion design

- Give every raw record an explicit `retention_expires_at`; do not rely on
  `created_at + interval` at query time only.
- Use a `legal_hold` flag with hold reason, requester, start, review date, and
  release. The purge worker selects only records with no active hold.
- Delete attachment objects first, then the row. If the row delete fails, the
  object is gone but the row remains; a retry and an orphan check are needed.
  Do not claim atomic deletion across Postgres and object storage.
- Soft-delete for a short grace period only if the UI needs undo; hard-delete on
  schedule. A soft-deleted row is still discoverable and must be included in
  retention and legal holds.
- Keep a tombstone with no PII (ID, deletion time, reason) to prove deletion and
  prevent accidental re-import. Do not keep the content "for audit."
- Delete derived thumbnails, transcodes, OCR text, and search indexes with the
  original.
- Test deletion in staging with a real object, a database row, a backup restore,
  and a legal hold. A green unit test on a mock is not deletion verification.

## 11. Threat model: legal requests

### 11.1 Principles

1. **Only a valid legal process gets a response.** A request from a police
   officer, an immigration agent, a lawyer, or a self-described investigator is
   not automatically valid. Counsel decides.
2. **One legal contact.** All requests go to a named legal lead and outside
   counsel. Moderators do not answer, negotiate, or forward records.
3. **Verify, scope, minimize.** Confirm the requester, authority, jurisdiction,
   time range, and specific records. Produce only what is legally required and
   responsive.
4. **Preserve before production.** Place a hold, preserve metadata, and document
   chain of custody. Do not delete anything after a request arrives.
5. **Notify the affected person unless legally prohibited.** A gag order,
   emergency, or safety risk can change this; counsel decides.
6. **Challenge overbreadth.** Ask for narrowing, quash or object where
   appropriate, and redact third-party PII.
7. **Log and report.** Keep a legal-request register and publish aggregate
   transparency information if counsel approves.
8. **Do not create a backdoor.** No moderator or support person can export the
   raw store on request; no shared inbox is a legal-request channel.

### 11.2 Request types and design response

| Request | Examples | Design response |
|---|---|---|
| Criminal subpoena | Local police, prosecutor | Counsel review; verify; preserve; produce minimum; consider notice |
| Warrant/court order | Search warrant, wiretap, 2703(d) | Counsel and technical lead; preserve; produce only ordered scope; document |
| Immigration administrative request/subpoena | ICE/DHS demand for reporter or subject data | Counsel; jurisdiction/authority analysis; do not voluntarily expand; notify unless prohibited |
| Civil discovery/subpoena | Litigant seeking identities or media | Counsel; object to overbreadth; protective order; redact; notify |
| Emergency disclosure request | Imminent death/serious physical harm | Director + counsel; minimum necessary; document; no routine "tip" channel |
| Preservation letter | "Do not delete" | Hold immediately; suspend purge; confirm in writing; review periodically |
| Vendor request | Supabase, Vercel, Resend, scanner, CAPTCHA | Vendor policy/notice; data map; counsel; the chapter cannot promise what a vendor holds |
| Foreign request | Another country's authority | Counsel; MLAT/diplomatic process; do not produce directly |
| Public records request | Not a government agency, but a funder/partner may ask | No obligation assumed; counsel; do not release personal data |
| Gag/nondisclosure | NSL or sealed order | Counsel only; no staff speculation; document access |

### 11.3 Legal-request runbook

1. **Receive and freeze.** Forward to the legal lead. Do not reply, delete,
   forward internally, or discuss with the reporter. Record time, channel,
   requester, and scope.
2. **Open a matter.** Assign a counsel owner and a technical custodian. Create a
   legal-hold record for the relevant reports, objects, logs, and backups.
3. **Verify authority.** Authenticate the document and requester through an
   independent channel. Check jurisdiction, date, signature, and scope.
4. **Assess and negotiate.** Counsel determines whether to comply, object, seek
   a protective order, or narrow. Do not produce beyond the order.
5. **Notify.** If permitted, tell the affected reporter/subject about the
   request and the response plan. Assess safety before notifying.
6. **Collect minimally.** Use a controlled export; redact third-party data; keep
   a chain-of-custody log; do not include unrelated reports.
7. **Produce securely.** Counsel-approved channel; no ordinary email; verify
   recipient; encrypt if appropriate; retain a copy of what was produced.
8. **Close the hold.** Only after written release; record the release; resume
   retention.
9. **Review.** Update the register, notify leadership/insurer if required, and
   consider a transparency note.

### 11.4 Questions for counsel before launch

- Is the chapter a "covered entity" or "service provider" under any privacy,
  breach-notification, or child-safety law that applies to this intake?
- What is the legal basis for collecting and publishing reports? Does the
  chapter need consent, a legitimate-interest analysis, or both?
- What are the obligations on suspected CSAM, credible threats, and graphic
  violence?
- Can the chapter promise confidentiality? What wording is accurate?
- What is the response obligation and deadline for access/deletion requests?
- How should immigration-related legal process be handled, and who is the
  escalation contact?
- Are there recording-law, defamation, anti-SLAPP, or Section 230 issues for
  published reports and media?
- What insurance and outside-counsel arrangements are in place?

## 12. Failure modes and resilience

| ID | Failure | Impact | Detection | Mitigation / launch gate |
|---|---|---|---|---|
| X1 | RLS or bucket misconfiguration exposes raw data | Mass deanonymization | Signed-out and role-based probes each deploy; bucket public check; policy diff | Separate private project/schema; no anon grants; automated regression test; immediate kill switch |
| X2 | Service-role key leaks in a bundle, log, or repo | Full read/write | Secret scanning; build artifact scan; provider alert | Server-only env; separate project; rotation; least privilege; no client import |
| X3 | Public projection includes a raw field | Doxxing | Schema/DTO allowlist test; diff preview; canary field | No `select *`; dedicated view; two-person preview; remove and correct |
| X4 | Moderator publishes by mistake | Harm, legal exposure | Post-publish checklist; second reviewer | Two-person rule; delay window; takedown runbook; correction log |
| X5 | Attachment scanner fails or is bypassed | Malware/CSAM exposure | Scan status; quarantine queue; alerts | Fail closed; no preview until clean; manual review; legal protocol |
| X6 | Database outage | Intake unavailable during an event | Health checks; error rate | Honest 503, retry, alternate trusted network; no false "received" |
| X7 | Storage outage/partial upload | Orphan files or lost media | Reconciliation job | Quarantine ledger; compensating delete; retry; no public link until complete |
| X8 | Email provider outage | Reporter cannot get receipt | Bounce/failure metrics | Show receipt token immediately; no email dependency; retry; alternate contact |
| X9 | Queue backlog | Stale reports look current | Queue age alert | Freshness labels; auto-expiry; pause intake; additional reviewers |
| X10 | Rate limiter is per-isolate or unavailable | Flood | Traffic anomaly; 429 rate | Durable global limiter; WAF; fail closed for writes; queue cap |
| X11 | Cache/CDN serves a private page | Leak | Header tests; cache logs | `no-store`, `private`, no shared cache; purge on incident |
| X12 | Search engine indexes a status/report page | Permanent exposure | Search console alerts; crawl tests | `noindex`, auth, robots, no sitemap; removal request |
| X13 | Email link scanner/prefetch consumes a token | Reporter cannot use link | Token-use logs | GET must not mutate; exchange token for session; single-use with clear error |
| X14 | Logs/Sentry/PostHog capture form data | Shadow PII | Log audit; vendor payload review | Scrubber; disable analytics/session replay on form; no content in errors |
| X15 | Backup restore resurrects deleted data | Privacy breach | Restore drill | Tombstone/replay deletions; backup retention; document limitation |
| X16 | Legal hold and purge race | Spoliation or wrongful deletion | Hold audit; worker errors | Hold check in transaction; pause worker; manual review |
| X17 | Admin account takeover | Mass publish/export | Anomaly alerts; MFA logs | SSO/MFA; short sessions; two-person; no bulk export; revoke |
| X18 | DDoS during an enforcement event | Map unavailable | Edge metrics | WAF; static fallback; status page; alternate network |
| X19 | Vendor breach or overbroad vendor request | Exposure | Vendor notice; audit | Minimize data; DPA; region review; encryption; counsel; vendor notice policy |
| X20 | Purge cron stops silently | Over-retention | Dead-man switch; record counts | Alert owner; runbook; manual invocation; test |
| X21 | Schema drift or unreviewed migration | Policy bypass | Migration diff; RLS guard | Migration review; staging; RLS tests; no console-only changes |
| X22 | Free text/media contains XSS or HTML | Session compromise | Sanitizer tests; CSP reports | Escape; no HTML rendering; separate origin for media; CSP; `nosniff` |
| X23 | User links trigger SSRF or tracking | Internal network/data exposure | Egress monitoring | Do not fetch user URLs; no previews; strip links; allowlist if ever needed |
| X24 | Moderator leaves or changes role | Unauthorized access | Access review | Immediate revocation; session invalidation; quarterly audit |
| X25 | False report causes real-world harm | Trust, safety, legal | Correction reports; monitoring | Unverified label; correction/removal; no "confirmed"; do not direct action |
| X26 | Scope creep turns intake into a person-tracking system | Mission and safety failure | Product review; data map | Written prohibited uses; board/counsel approval; feature freeze |

## 13. Recommended control architecture

This is a design shape, not an implementation plan. The ordering matters: the
privacy boundary must exist before the form is exposed.

### 13.1 Intake

- Public page, no account required, optional contact. Use a clear safety
  preamble: this is not 911, do not approach or obstruct, do not include names,
  faces, plates, addresses, or immigration status.
- Structured fields with server-side validation (Zod or equivalent), strict
  length limits, Unicode normalization, control-character rejection, and no
  HTML. Never render raw report text as HTML.
- City/state selection from a known list, not a free-text exact address. If the
  product needs a private location, collect it in a separate encrypted field
  and never project it.
- Server-side request body limit **while streaming**, not only `Content-Length`.
  Reject oversized multipart bodies before parsing the whole payload.
- Honeypot plus a privacy-reviewed proof-of-work or CAPTCHA. Do not make
  accessibility or Tor use impossible; test the challenge with keyboard and
  screen-reader users.
- Durable rate limits: per IP hash, per contact (if provided), per network, and
  global. Return `429` with `Retry-After`. Do not silently accept and drop.
- Same-origin checks, no wildcard CORS, no credentials on the public POST, and
  an idempotency key to prevent duplicate drafts on retry.
- Return an opaque receipt token and a clear statement that receipt is not
  publication, verification, or a promise of help.

### 13.2 Private store

- Prefer a **separate Supabase project** for raw reports and attachments. A
  project-wide service key is too broad for a high-risk store that shares a
  project with the CMS, CRM, and public content.
- If a separate project is not feasible, isolate the raw tables in a dedicated
  schema and use a dedicated server-only credential/role with table-level
  grants. Document the residual risk that a project-wide key still crosses the
  boundary.
- RLS enabled with **no** anon/authenticated policies on raw tables. Only the
  server route and a narrowly scoped moderation service can read/write.
- Separate tables/views for `report_raw`, `report_moderation`, and
  `report_public`. The public view has an explicit column allowlist and a
  `published` predicate.
- Application-level encryption for contact details and any private subject
  identifiers. Keys live in a secret manager, not in the database or repo.
- Private bucket, `public = false`, no public policies, random object paths,
  short-lived signed URLs or a proxy route. No public CDN.
- Audit table is insert-only from the app; no update/delete grants to ordinary
  roles. Keep actor, action, report ID, timestamp, and reason, not content.

### 13.3 Moderation

- Invite-only accounts, MFA, named roles, least privilege, fast session expiry.
- Queue with statuses and an audit trail; no raw media in list views; reveal
  full record only on demand and log the reveal.
- Two-person publish; conflict recusal; written rubric; training; QA sampling.
- Redaction tools that produce a new public derivative; never edit the original
  in place.
- Emergency removal and correction path with a named safety lead.
- Moderator wellness protocol and a no-solo-CSAM rule.

### 13.4 Publication

- A dedicated public projection table/view, populated only after approval.
  Fields: city, state, category, coarse time bucket, generic summary,
  unverified-community label, published/corrected timestamps. No report ID that
  links back to the raw record, no reporter metadata, no media at launch.
- City centroid only, matching the current feed's practice. No exact
  coordinates in the public payload, HTML, structured data, or map state.
- Display age and freshness. Do not present an old report as active. Do not
  compute a public surge from unreviewed submissions.
- Clearly label community reports as unverified. Do not use "confirmed" unless
  a written evidence standard was met and the label is approved by policy.
- Keep a correction/removal path visible on the public item and in the site
  footer.

### 13.5 Legal and retention

- `retention_expires_at` and `legal_hold` on every raw record.
- A purge worker that selects only unheld expired records, deletes objects
  first, then rows, records a tombstone, and alerts on failure.
- A legal-request register, counsel contact, preservation template, and
  transparency policy.
- Vendor/subprocessor inventory with data region, retention, and legal-contact
  details.

### 13.6 Observability

- Monitor intake success/failure, 4xx/5xx, queue age, quarantine backlog, purge
  failures, storage growth, auth anomalies, and report/object count drift.
- Alert a named owner; a cron that fails silently is a data-retention incident.
- Never log request bodies, report text, contact details, tokens, signed URLs,
  or attachment names. Use report IDs and hashed correlation IDs.
- Disable session replay and autocapture on the intake and moderation pages.
  Scrub error-monitoring payloads before sending.

## 14. Launch checklist

Every item needs an owner and evidence. A checked box without evidence is not a
control.

### Gate A — Purpose, policy, and legal

- [ ] Written purpose and prohibited uses approved by the chapter owner/board:
      event reporting, not person tracking; no dispatch; no immigration-status
      collection; no harassment.
- [ ] Decision recorded: public sanitized reports vs. private-only intake.
- [ ] Counsel reviewed the privacy notice, terms, publication policy, recording
      and copyright issues, defamation/anti-SLAPP risk, CSAM/threat duties,
      breach notification, and legal-request handling.
- [ ] Data map and retention schedule approved; each period has an owner.
- [ ] Data-processing agreements/subprocessor review for Supabase, Vercel,
      Resend, error monitoring, CAPTCHA/scanner, and any analytics.
- [ ] Legal-request runbook, outside-counsel contact, preservation template, and
      transparency policy approved.
- [ ] Insurance/cyber coverage and incident-response contact confirmed.
- [ ] Public copy updated: the current "this page does not collect reports"
      statement is changed deliberately, with a safety explanation and a link
      to the alternate trusted network.

### Gate B — Privacy and PII

- [ ] Contact details optional; no account required; no marketing consent
      bundled with a report.
- [ ] Form rejects or warns against names, addresses, plates, faces, A-Numbers,
      immigration status, medical details, minors, and employer/school details.
- [ ] Public projection is city-level and coarse-time only; no exact location
      in HTML, JSON, map state, metadata, or structured data.
- [ ] Reporter notice is accurate about minimization, access, retention, legal
      requests, and the limits of anonymity.
- [ ] Analytics/session replay disabled on intake and moderation; error reports
      scrubbed; no raw PII in logs or email.
- [ ] Field-level encryption for contact/high-risk fields; keys separated from
      the database.
- [ ] Access roles, MFA, reveal audit, no bulk export, and offboarding tested.
- [ ] Data-subject request and deletion-verification procedure documented.

### Gate C — Abuse resistance

- [ ] Durable global and per-identity rate limits are live and tested across
      more than one server instance.
- [ ] Proof-of-work/CAPTCHA/honeypot is live, accessible, and privacy-reviewed.
- [ ] Streaming body limits and upload limits reject oversized input before
      expensive parsing.
- [ ] Same-origin/CSRF checks and restrictive CORS are tested from a foreign
      origin.
- [ ] Idempotency and duplicate detection work on retry.
- [ ] Queue caps/backpressure and a documented "pause intake" switch exist.
- [ ] Abuse reporting, threat escalation, and moderator-protection contacts are
      published internally.

### Gate D — Storage and access

- [ ] Raw store is separate from public content (separate project preferred;
      otherwise documented isolation and residual risk).
- [ ] RLS enabled with no anon/authenticated policies on raw tables.
- [ ] Buckets are private; no public policies; object paths are unguessable.
- [ ] Service credentials are server-only, not in the client bundle, and
      rotation-tested.
- [ ] Public projection is an allowlist view/table, not a filtered raw query.
- [ ] Signed URLs are short-lived, audited, and `no-store`; private pages are
      not cached or indexed.
- [ ] Migration review and signed-out/role-based probes pass in staging and
      production-like config.
- [ ] Backups documented; restore test includes deletion and legal-hold replay.

### Gate E — Moderation operations

- [ ] Named roles: triager, verifier, publisher, safety/legal, admin.
- [ ] Two-person publication and conflict-recusal rules are enforced, not just
      written down.
- [ ] Rubric, prohibited-content checklist, redaction checklist, and examples
      are trained.
- [ ] Queue/SLA, freshness labels, auto-expiry, and pause-intake procedure are
      live.
- [ ] Audit log captures create/reveal/edit/approve/publish/remove/delete with
      actor and reason.
- [ ] Correction/appeal/emergency-removal path is visible and staffed.
- [ ] Moderator wellness, CSAM/threat protocol, and no-solo-review rule are in
      place.
- [ ] Access review and offboarding tested with a departing test account.

### Gate F — Attachments (only if enabled; otherwise record a conscious
"no media at launch" decision)

- [ ] Allowlist JPEG/PNG/WebP, size/pixel caps; reject SVG, PDF, ZIP, HTML,
      executables, animated, and multi-page files.
- [ ] Magic-byte validation and sandboxed decode with time/memory limits.
- [ ] Re-encode from pixels; strip EXIF/XMP/IPTC/embedded thumbnails; verify
      with a metadata reader.
- [ ] Malware scan and counsel-approved CSAM hash matching; quarantine until
      clean.
- [ ] Human redaction of faces, plates, addresses, screenshots, and bystanders;
      second review of the exact derivative.
- [ ] Private bucket, no public CDN, short-lived access, no inline preview
      before scan.
- [ ] Original retention and deletion tested; no orphan objects.
- [ ] No audio/video at launch unless counsel and operations approve a separate
      pipeline.

### Gate G — Retention, deletion, and legal

- [ ] Every raw record has an expiry; the purge job is scheduled and monitored.
- [ ] Legal hold is enforced by the purge worker and tested under a race.
- [ ] Object-first deletion, tombstone, retry, and orphan reconciliation work.
- [ ] Backup/restore and third-party copy behavior documented in the privacy
      notice.
- [ ] Legal-request register, preservation, verification, notification, and
      production steps rehearsed in a tabletop.
- [ ] Vendor legal-notice contacts and data-region facts are recorded.
- [ ] Transparency/reporting policy approved.

### Gate H — Reliability and incident response

- [ ] Health checks, error alerts, queue-age alerts, purge-failure alerts, and
      storage-growth alerts reach a named person.
- [ ] Honest 503/alternate-channel page exists for database, storage, email, or
      rate-limiter failure; it does not claim a report was received.
- [ ] Kill switch can disable intake and/or publication without a deploy.
- [ ] Incident runbooks cover: raw-data exposure, moderator takeover, malicious
      upload, CSAM/threat, legal hold, deletion failure, and provider breach.
- [ ] Breach-notification decision tree and counsel contact are tested.
- [ ] Backup restore, DDoS degradation, and vendor outage are exercised.

### Gate I — Verification before exposure

- [ ] Threat-model review with engineering, moderation, counsel, and an outside
      reviewer; findings assigned and closed.
- [ ] RLS/bucket tests: signed-out, ordinary authenticated, moderator, publisher,
      admin, and service role. No unexpected read/write.
- [ ] Upload fuzzing: wrong MIME, polyglot, oversized, decompression bomb,
      malformed image, metadata payload, SVG/PDF/ZIP, truncated file.
- [ ] XSS/injection/CSRF/SSRF tests; no user HTML or fetched links.
- [ ] Token enumeration, receipt replay, email prefetch, cache, and indexing
      tests.
- [ ] End-to-end synthetic report through triage, redaction, second review,
      publication, correction, hold, and deletion.
- [ ] Accessibility and language review; the form works on a phone and with a
      screen reader.
- [ ] Closed beta with synthetic or consented test data only; no real reporter
      PII in staging or demos.

### Gate J — Launch and post-launch

- [ ] Go/no-go meeting with owner, counsel, moderation lead, and engineering.
- [ ] Public privacy notice, form warning, correction path, and alternate
      reporting channel are live.
- [ ] Monitoring dashboard and on-call owner are active at launch.
- [ ] First 24 hours: queue age, errors, abuse, access log, and any publication
      reviewed; incident channel staffed.
- [ ] First 7 days: retention/purge dry run, access review, correction review,
      moderator debrief.
- [ ] First 30 days: privacy/security review, transparency metrics, deletion
      spot-check, tabletop update.
- [ ] Quarterly: access review, retention audit, vendor review, abuse review.
- [ ] Annually: re-run this threat model; update after any product change,
      legal change, incident, or new data source.

## 15. Go/no-go rules

Do **not** launch if any of these is true:

1. There is no counsel-approved privacy notice and legal-request process.
2. The raw table or bucket is reachable by anon/authenticated users, or the
   public projection is a filtered raw query.
3. A single reviewer can publish without a second approval.
4. Attachments are enabled without quarantine, scanning, metadata stripping,
   and redaction.
5. Retention and legal hold are not executable and tested.
6. Rate limiting is only in-memory/per-instance and there is no WAF/queue.
7. Moderator accounts lack MFA or access review.
8. Logs, analytics, or error monitoring receive raw report content.
9. There is no correction/removal path or named safety owner.
10. The public copy still implies no reports are collected, or overpromises
    anonymity, verification, or help.

**Recommended staged launch:** text-only, private/closed beta with no public
media, no search indexing, and a small trusted moderation group; then a
sanitized city-level public projection; then consider media only if the Gate F
controls are proven. Do not launch the full feature and the media pipeline on
the same day.

## 16. Residual risks to state plainly

Even with every control, these remain:

- A determined legal request or vendor compromise may identify a reporter.
- A moderator can make a mistake, and screenshots cannot be prevented.
- Public city/time/category data can be combined with other data to infer more
  than intended.
- False reports can still cause harm before correction.
- A sophisticated attacker can evade rate limits and content filters.
- Provider backups and logs may retain data beyond the application's deletion.
- Moderation is human and will be inconsistent at the margins.

The launch copy and internal policy should not promise perfect anonymity,
perfect verification, complete deletion, or an emergency response.

## 17. Open decisions for the chapter and counsel

1. Is this a public alert system, a private advocacy intake, or both?
2. What evidence standard, if any, justifies a "confirmed" label?
3. Is any form of anonymity being promised? If so, what is the end-to-end
   design, including edge logs, email, and legal process?
4. Who is the accountable moderation owner, and who is the legal lead?
5. Are reports shared with Stop ICE, coalition partners, journalists, or
   researchers? Under what written agreement and consent?
6. Are attachments necessary at launch, or can the product ship text-only?
7. What is the data region and subprocessor list?
8. What is the retention period for raw reports, media, contact details, and
   audit logs?
9. How will correction, removal, and subject requests be handled?
10. What is the policy for threats, CSAM, and credible violence?
11. What is the policy for law-enforcement contact, emergency disclosure, and
    transparency reporting?
12. Who funds moderation and incident response after launch?

## 18. Bottom line

The feature is defensible only as a **minimized, reviewed, time-limited event
report**, not as an identity-rich tip line. The engineering effort should go
first into isolation, deletion, review, and legal readiness — not into a richer
form. If the chapter cannot staff two-person moderation, counsel, retention,
and incident response, the safer product is to keep linking to an existing
trusted reporting network and not collect reports at all.
