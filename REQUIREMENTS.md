# Gatherly — requirements & functionality

An online-stationery app: a host designs a card, dresses an envelope, publishes a guest page and
collects RSVPs. This document is the functional spec the build targets. It was written after
reviewing how Paperless Post describes its own workflow (design → envelope/liner/stamp → backdrop →
event details → page style → blocks → RSVP settings). All artwork, copy, palettes and fonts here are
original; no Paperless Post assets, code or text are used.

Status legend: **[built]** implemented and exercised in this repo · **[spec]** specified but not
implemented here.

This revision describes the build as of November 2026, including accounts, object storage, rate
limiting, reminders, check-in and the app shell — all of which earlier revisions listed as
unimplemented.

---

## 1. Personas

| Persona | Needs |
| --- | --- |
| **Host** | Design an invitation quickly, control every visual detail, know who is coming, chase replies, seat everyone, export a list. |
| **Co-host** | See the same guest list, replies, seating and door screen as the owner, without taking ownership. |
| **Guest** | Open something that feels like mail, understand the details in one screen, reply in under a minute, keep their pass on their phone. |

---

## 2. Core flows

1. **Start** — browse eight designs (`/`), pick one, land in the editor with sample wording.
2. **Customize** — card text, type, colours, artwork, border, cover photo or framed portrait, envelope, liner, stamp, backdrop.
3. **Describe** — event title, host, start/end, venue, address, description, dress code.
4. **Configure replies** — toggle RSVPs, public guest list, plus-ones, adults/children headcount,
   capacity, deadline, custom questions.
5. **Style the page** — page background, text, accent, heading/body fonts.
6. **Add context** — blocks: notes, schedules, links (registry, travel).
7. **Invite** — add guests by name/email/household/group; copy a shared link or a signed personal link per guest.
8. **Guest opens** — envelope with their name → flap opens → card → "Open the invitation" → page.
9. **Reply** — accept / decline / maybe, plus party size, dietary and access notes, answers, note to hosts.
10. **Track** — dashboard stats, table of replies, notes, CSV export, manual status overrides.
11. **Nudge** — schedule an email or text reminder, or send one now.
12. **Seat** — draw tables on a floor plan, place parties, finalize so guests can see their table.
13. **On the door** — scan each pass (or type the code), undo a scan, add walk-ins, print the report.
14. **Share** — add a co-host by email; they get the guest list, seating and check-in, not ownership.

---

## 3. Customization requirements

### 3.1 Card design **[built]**

| # | Requirement |
| --- | --- |
| D1 | At least six starting designs spanning formal, garden, evening, minimal, party, romantic and summer styles. *(8 shipped)* |
| D2 | Switching design restyles colours, artwork, border, envelope and page — and **keeps the typed words**. |
| D3 | Decorative artwork is switchable independently of the design (9 motifs incl. "none"). |
| D4 | Card border options: none, hairline rule, double rule, inset frame; border colour editable. |
| D5 | Optional cover photo with adjustable opacity, drawn behind the text and artwork. |
| D6 | Card is a fixed 5:7 portrait; all type scales with the card, so nothing reflows between preview and guest page. |
| D7 | Each design carries its own card motion — falling leaves, drifting petals, confetti, gilt sparkle, dust motes or snow — drawn in the card's own ink and accent. A design can deliberately have none. |
| D8 | Motion is switchable independently of the design (six kinds plus "none") and animates on the card everywhere it appears: the envelope peek, the card stage, the gallery and the editor. It is pure CSS — no images, no scripts — and stays behind the words. |
| D9 | With `prefers-reduced-motion: reduce`, the card motion is not rendered at all. |
| D10 | Optional portrait photo in a frame above the host names: shape (circle, arch, oval, soft), width in card-relative units, and free position, all editable. |
| D11 | The cover photo, the portrait and the backdrop image are three independent slots; replacing one never disturbs the others. |

### 3.2 Text **[built]**

| # | Requirement |
| --- | --- |
| T1 | Multiple independent text lines, each with a name for the layers panel. |
| T2 | Add, duplicate, hide/show and delete lines. |
| T3 | Per line: words (multi-line), font (10 families), size, weight (300–700), italic, caps, letter-spacing, line-height, alignment, colour. |
| T4 | Per line: position (x/y as % of card) and width, editable by sliders **and by dragging on the card**. |
| T5 | Dragging must update position in card-relative percentages, not pixels, so it survives preview scaling. |
| T6 | Selection is visible on the card; hidden lines stop rendering but keep their settings. |

### 3.3 Colour **[built]**

| # | Requirement |
| --- | --- |
| C1 | Six curated palettes apply background + ink + accent + page colours in one click. |
| C2 | Any colour is editable by picker or hex code (custom colour is a first-class feature, not a premium add-on). |
| C3 | "Ink" recolours every text line at once; per-line colour overrides it afterwards. |

### 3.4 Envelope **[built]**

| # | Requirement |
| --- | --- |
| E1 | Envelope is optional — off means the guest link opens straight to the card. |
| E2 | Envelope paper colour is editable. |
| E3 | Liner patterns: blank, solid, diagonal stripe, pin dots, scallop, sprig; two liner colours. |
| E4 | Stamp designs: arch, bloom, fan, field, monogram; stamp ink editable. |
| E5 | The guest's own name prints on the front (`For <name>`), falling back to "Guest name" in preview. |
| E6 | Envelope name font is selectable; name ink flips black/white automatically for contrast. |
| E7 | Optional return address on the front. |
| E8 | Opening is choreographed: the flap rotates up on its top edge (900 ms) revealing the lined interior, then the card rises out of the pocket (1150 ms) through the notch between the pocket's diagonal edges, and finally the full card settles while the envelope sinks away (520 ms). |
| E9 | Honour `prefers-reduced-motion`: with motion reduced, the envelope opens straight to the card with no transitions. |
| E10 | A paper-swish plays as the envelope opens, synthesised in WebAudio (no audio asset, no download). A toggle beside the envelope mutes it; the choice is remembered in `localStorage`. |
| E11 | The envelope reads as folded paper, not a flat rectangle: a crease shadow runs along the flap's diagonal edges, the paper carries a soft inner edge and the addressee sits on a printed hairline rule. On dark stock the crease flips to a highlight instead of disappearing. |
| E12 | Flap silhouette is selectable: pointed, rounded tip, or banker (flat). Each silhouette carries its own matching crease. |
| E13 | Paper stock is selectable: smooth, laid lines, or grain, printed across the whole sheet including its folds. |
| E14 | Optional wax seal at the flap tip: a monogram of the host's initial or a rosette impression, with editable wax colour. It breaks away as the flap opens. The stamp sits slightly askew with a postal cancellation beside it. |
| E15 | Flap stays fully visible throughout the open sequence — `backface-visibility: hidden` removed from `.env-flap` so the rotated flap remains visible as it turns past 90°; envelope open choreography (flap 900 ms → card rise 1150 ms → leaving 520 ms) has no pop/zoom or jitter at stage transitions; verified by frame-by-frame screenshot at 320/540/700/870/1200/1850/2420 ms. |
| E16 | Sound toggle stays mounted during open (only hidden via `visibility: hidden`) so the envelope stage geometry stays consistent and the envelope never drops/shrinks when the scrollbar toggles. |
| E17 | Opening speed/style is selectable: classic, quick, slow or wide. The chosen motion is what the guest sees. |

### 3.5 Backdrop **[built]**

| # | Requirement |
| --- | --- |
| B1 | Patterns: plain, paper grain, linen, gradient, confetti, sunburst; two colours. |
| B2 | Upload your own image to replace the pattern (PNG/JPEG/WebP/GIF/AVIF; 3.5 MB cap). |
| B3 | Backdrop appears behind the envelope and the card, never behind the event page. |

### 3.6 Event page **[built]**

| # | Requirement |
| --- | --- |
| P1 | Page colours (background, text, accent) and heading/body fonts are set separately from the card. |
| P2 | Event details: title, host names, start, end, venue, address, description, dress code. |
| P3 | "Add to calendar" generates an `.ics` file with the real start/end and location. |
| P4 | "Directions" opens the venue in maps. |
| P5 | Blocks (note / schedule / link) render below the details; schedules keep line breaks. |
| P6 | Guest list is shown publicly only when the host enables it. |
| P7 | A guest with a personal link sees their own name on the envelope and the page; a shared link asks who is replying. |
| P8 | The guest page is a projection: it carries the card, event, page style and blocks, never the guest list or replies. |
| P9 | A pasted guest link unfurls with the event title, host, date and place, a clipped line of the description, and a 1200×630 preview image drawn in the card's own palette. |

### 3.7 RSVP and guest management **[built]**

| # | Requirement |
| --- | --- |
| R1 | Collect RSVPs is a switch; off means the page is informational only. |
| R2 | Replies: joyfully accept, regretfully decline, maybe. |
| R3 | Plus-ones allowed up to a host-set maximum; ignored when the guest declines. |
| R4 | Optional separate adult/child headcount. |
| R5 | No plus-one field is shown when the headcount is enabled — party size is expressed once, not twice. |
| R6 | Capacity is enforced server-side; a reply that would exceed it is rejected with a clear message. |
| R7 | RSVP deadline is enforced server-side; after it, the form is replaced by a closed notice. |
| R8 | Host-defined questions (text or choice) with required flags; answers are stored per guest and shown to the host. |
| R9 | Guests can leave a note for the hosts, plus dietary and accessibility notes and a household name. |
| R10 | One reply per guest: a signed personal link wins, then a unique email address, then an unclaimed host-started row with that name. |
| R11 | Host can add guests (name, email, household, group), change any reply status, and remove a guest. |
| R12 | Headcount = the people named, or the guest plus their plus-ones, whichever is more; never double-counted. |
| R13 | Per-guest personal links (`/i/<id>?g=<guestId>&t=<signature>`) prefill the name and envelope. The signature is what proves the link, not the id. |
| R14 | CSV export of the guest list with replies, party size and notes. |
| R15 | Each named plus-one becomes its own guest row, so they can be renamed and seated in a chair of their own. |
| R16 | Guests may leave a mobile number and explicit SMS consent; without consent no text is ever sent. |
| R17 | A host can undo a removed guest, restoring the same id so their personal link still works. |

### 3.8 Host tools: dashboard, check-in, seating **[built]**

| # | Requirement |
| --- | --- |
| H1 | Dashboard stats: invited, attending, headcount, replied %, checked in. |
| H2 | Reply table with status filters, search by name/household/email, notes and manual overrides. |
| H3 | Copy the shared link or any guest's personal link. |
| H4 | Check-in screen: camera scan of a guest's pass, or type the pass code / guest name / link. |
| H5 | Undo a scan, add a walk-in at the door, and see expected / checked-in / remaining counts. |
| H6 | Printable check-in report at `/host/<id>/checkin/report`. |
| H7 | Seating plan: round, long and square tables with chairs, venue items, drag placement, spare chairs, and a finalized flag that releases each guest's table to them. |
| H8 | Guests are seated by party size; the plan stores the size each guest held when placed so drift is visible after a reply changes. |

### 3.9 Sending updates **[built, provider required]**

| # | Requirement |
| --- | --- |
| S1 | Email blasts and text blasts, each aimed at attending, pending or all reachable guests. |
| S2 | Email goes through Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set, or a generic JSON gateway (`EMAIL_API_URL` + `EMAIL_API_KEY` + `EMAIL_FROM`). |
| S3 | Text goes through Twilio when its three variables are set, or a generic JSON gateway (`SMS_API_URL` + `SMS_API_KEY` + `SMS_FROM`). |
| S4 | With no provider the send is recorded as `not-configured` with the missing variable names; invitations still work as shared links. |
| S5 | Scheduled RSVP reminders (audience: pending / maybe / all) are stored on the invitation and sent only when a host presses "Send due reminders" or "Send now" — never because a page was viewed or prefetched. |
| S6 | A reminder is claimed before sending, so two tabs cannot message everyone twice; a crashed send's claim expires after 15 minutes. |
| S7 | Reminders never target declined guests, plus-one rows, or an address/number without consent. |
| S8 | Every blast and reminder records recipients, delivered, failed and a status. |

### 3.10 Accounts and sharing **[built]**

| # | Requirement |
| --- | --- |
| A1 | Sign up, sign in, sign out and password reset (scrypt hashes, signed session cookie, 30-day expiry). |
| A2 | Every invitation has an owner; the dashboard lists only invitations you own or co-host. |
| A3 | A co-host is an email address on the invitation; adding one grants manage access without transferring ownership. |
| A4 | Only the owner may delete an invitation; co-hosts may edit and manage guests. |
| A5 | Password reset links are emailed when a mail provider is configured; with none, the link is returned only in development. |
| A6 | Invitations created before accounts existed are adopted by the first account to sign in. |

### 3.11 App shell **[built]**

| # | Requirement |
| --- | --- |
| M1 | `/app` is a tabbed shell for phones: designs, create, an invitation's editor, guests, seating and account. |
| M2 | The desktop routes (`/create`, `/i/<id>`, `/host/<id>`) remain available and share the same components and API. |

---

## 4. Business rules (implemented)

The reply rules live in `lib/rsvp-rules.ts` as pure functions and are covered by
`tests/rsvp-rules.test.ts`. Everything else is enforced by the route that owns the data.

1. **Design saves never own guest data.** `PUT /api/invitations/:id` replaces only design, text,
   details, settings, page and blocks. Guests, replies, ownership, co-hosts, send history and the
   seating plan are copied from the server's document inside the same locked transaction, so an
   open editor cannot erase a reply that arrived mid-edit.
2. **Reply identity order:** signed personal link → the one row with that email address → a host-
   started row with that name and no email that has never replied. An address that appears on two
   rows matches neither. A typed name never claims a row that carries an email or has already
   replied, because names are public.
3. **Capacity** compares the heads already committed (attending parties, excluding the replying row
   and the plus-one rows it brought) plus the new party size against `settings.capacity`.
   Over-capacity returns HTTP 409 and writes nothing.
4. **Disabled RSVPs and a past deadline** return HTTP 403 and write nothing. Both use the server
   clock.
5. **Numeric input is clamped, not trusted:** plus-ones 0–`maxPlusOnes` (0 when plus-ones are off),
   adults 1–20 and children 0–20 when headcount is on. Fractions round; unusable input becomes the
   minimum.
6. **Declining clears the party** (plus-ones, adults, children) so a later "yes" cannot inherit
   stale counts. This applies to guest replies and to host status overrides.
7. **Plus-ones become rows.** Each named companion is stored with `companionOf` pointing at the
   guest who brought them; reducing the party removes the surplus rows, and a headcount reply
   removes them all.
8. **Headcount maths:** an attending guest is `max(1, adults + children, 1 + plusOnes)` heads;
   everyone else is 0. Capacity, the dashboard totals and check-in all use this rule.
9. **Guest text is stored and rendered as text**, never as HTML — React escapes it.
10. **Motif, border and colours are independent** of the design switch; switching design never
    rewrites the words.
11. **Personal links are signed.** `guest-token.ts` signs the invitation/guest pair with the
    session secret; an id without a valid signature proves nothing and is ignored.
12. **Sends are explicit.** No page view, prefetch or reminder read triggers a message; only a
    button press calls the send path, and a reminder is claimed before it is sent.

---

## 5. Data model (see `lib/types.ts`)

```
Invitation
├─ id, ownerId?, collaborators?, createdAt, updatedAt
├─ designSlug, title, subject
├─ card      { background, ink, accent, motif, border, borderColor,
│              photo, photoOpacity, portrait, portraitShape, portraitSize,
│              portraitX, portraitY, drift?, layers[]:
│                { name, text, font, size, color, weight, italic, uppercase,
│                  tracking, lineHeight, align, x, y, width, visible } }
├─ envelope  { enabled, color, flap, texture, seal, sealColor, linerPattern,
│              linerColor, linerColor2, stamp, stampColor, font,
│              openAnimation, returnAddress }
├─ backdrop  { pattern, color1, color2, image }
├─ event     { title, host, startsAt, endsAt, location, address, description, dressCode }
├─ settings  { collectRsvp, showGuestList, allowPlusOnes, maxPlusOnes, capacity,
│              deadline, headcount, textUpdates?, questions[] }
├─ page      { background, text, accent, fontBody, fontHeading }
├─ blocks[]  { id, type: note|schedule|link, title, body, url }
├─ guests[]  { id, name, email, household?, dietary?, accessibility?, phone?,
│              smsConsent?, tag, status, plusOnes, adults, children, answers,
│              message, respondedAt, companionOf?, checkedInAt?, checkedInBy? }
├─ seating?  { tables[], items?, snapshot?, finalized?, updatedAt? }
├─ texts?    TextBlast[]
├─ emails?   EmailBlast[]
└─ reminders? Reminder[]
```

Sizes are **percentages of card width/height**, not pixels — this is what makes the same invitation
render identically in a 265 px gallery thumbnail, a 392 px editor canvas and a 400 px guest card.

---

## 6. Interface

| Route | Purpose |
| --- | --- |
| `/` | Design gallery, saved and shared invitations. |
| `/create?design=` / `/create?id=` | Editor (creates an invitation on first visit). |
| `/i/<id>[?g=<guestId>&t=<token>]` | Guest experience: envelope → card → page → RSVP. |
| `/host/<id>` | Guest list, stats, status changes, reminders, texts, emails, CSV. |
| `/host/<id>/checkin` | Door screen: scan or type a pass, undo, walk-ins. |
| `/host/<id>/checkin/report` | Printable check-in report. |
| `/host/<id>/seating` | Seating plan editor. |
| `/app` | Phone-shaped app shell (designs, create, editor, guests, seating, account). |
| `/signin`, `/reset` | Accounts. |
| `GET/POST /api/invitations` | List / create. |
| `GET/PUT/DELETE /api/invitations/<id>` | Load / autosave / delete. |
| `POST /api/invitations/<id>/rsvp` | Guest reply (public, rate limited). |
| `POST/PATCH/DELETE /api/invitations/<id>/guests` | Host-side guest list. |
| `POST /api/invitations/<id>/guests/merge` | Fold one guest row into another. |
| `POST/PUT/DELETE /api/invitations/<id>/reminders` | Schedule / send due / cancel. |
| `POST /api/invitations/<id>/texts` | Text blast. |
| `POST /api/invitations/<id>/emails` | Email blast. |
| `/api/invitations/<id>/checkin` | Scan, undo, walk-ins. |
| `/api/invitations/<id>/seating` | Read and save the plan. |
| `/api/invitations/<id>/collaborators` | Co-host list. |
| `/api/invitations/<id>/photo/<slot>` | Serve an inline photo without loading the document. |
| `POST /api/uploads` | Object-storage upload (signed in, rate limited, sniffed). |
| `POST /api/auth/signup`, `/signin`, `/signout` | Accounts. |
| `POST /api/auth/reset/request`, `/confirm` | Password reset. |
| `GET /api/health` | Database-backed readiness probe (`200`/`503`). |
| `POST /api/jobs/sweep-images` | Orphan-image sweep (bearer `CRON_SECRET`). |

---

## 7. Non-functional requirements

**[built]** Responsive down to 320 px; the editor stacks and a handful of two-column rows stack
below 560 px. Autosave on a 650 ms debounce, with a visible saved/saving/not-saved state.
Keyboard-reachable controls with visible focus; every form control labelled. Fonts loaded once
from Google Fonts with system fallbacks.

**[built]** Authentication and per-account isolation; co-host access; object storage for uploaded
images (S3-compatible); rate limiting on sign-in, sign-up, reset, uploads and the public RSVP
endpoint; password reset by email.

**[built]** One check command: `npm run check` runs `tsc --noEmit`, ESLint (`next/core-web-vitals`)
and the Vitest suite for the §4 reply rules and the share helpers. `npm run test:db` is separate and
needs Postgres: it drives the real guest page and RSVP route for personal-link access, unknown ids
and closed replies.

**[spec]** Plans — `users.plan` is `note`, `letter` or `suite` and caps how many invitations an
account may hold (1, 3, 10); the create route enforces it and `/app/account` shows the plan and the
count. Plans are granted by hand (`npm run db:plan -- <email> <plan>`) because there is no checkout;
the landing page's price list at `/#pricing` says so. Also spec: paid print; audit log of answer
changes; editor undo/redo; localisation; a cross-browser and mobile-device test matrix.

---

## 8. Deliberately out of scope

These are Paperless Post features that this build does **not** include, because they need
infrastructure or commercial agreements rather than design work:

- Teams, CRM sync, guest tags/segments beyond the household and group strings.
- Bounce, open and delivery-event tracking. Sends go out through a provider (Twilio or a JSON SMS
  gateway; Resend or a JSON email gateway) and the app only records the counts each API call
  returns; invitations still work as plain shared links when no provider is connected.
- A coin economy, self-serve checkout and paid print fulfilment. Plans themselves exist (§7) but are
  granted by hand; the prices on `/#pricing` are illustrative and nothing is charged.
- AI "magic" artwork and sticker generation, comment walls, and a public event-discovery feed.
- Real-time collaboration in the editor.

---

## 9. Known limitations

1. **Everything lives in Postgres.** Invitations and replies (including guests, seating, sends and
   reminders) are stored as whole documents in the `invitations` table, with `owner_id`,
   `updated_at` and `collaborators` lifted into indexed columns. Accounts, scrypt password hashes
   and reset tokens are in `users`; the cookie signing key is a row in `app_settings`, so any
   instance signs and verifies the same sessions. Invitation writes take a row lock inside a
   transaction, so concurrent edits cannot lose each other. The `.data/*.json` files are import
   sources only.
2. **Sessions are stateless cookies.** Signing out clears the cookie, but a copied cookie stays
   valid until it expires or the password changes; a reset bumps the password version and retires
   every older session. There is no revocation list yet, so a leaked cookie can only be killed by
   resetting the password or shortening `SESSION_MAX_AGE`.
3. **Guest identity is still partly name/email based.** Personal links are signed now, so a link
   holder cannot answer for a row they were not sent. But a guest who arrives without their link
   can still be matched by a unique email address, and any unclaimed host-started row with their
   name can be filled in. Production-grade invitations would use single-purpose, expiring tokens
   for every path.
4. **Uploads are half-moved.** With `S3_*` configured, images go to object storage and the document
   keeps a URL; without it the editor still inlines data URLs, and every invitation made before the
   change keeps the bytes it already has. Replaced images and the images of a deleted invitation are
   removed once no invitation references them, and a sweep clears the objects left by uploads that
   were never saved. Nothing migrates the old inline data URLs; `db:shrink-images` only re-encodes
   them.
5. **Something has to run the scheduler.** `npm run scheduler` is a companion process that posts to
   the image-sweep endpoint on an interval; starting `next start` alone does not sweep. A host that
   sleeps or scales to zero pauses it, which is why the endpoint can also be driven by an external
   cron. Scheduled reminders are **not** sent by the scheduler: they fire only when a host presses
   "Send due reminders" or "Send now".
6. **Rate limits are per process.** Sign-in, sign-up, password reset, uploads and the public RSVP
   endpoint are throttled in `lib/rate-limit.ts`. The key is the address reported by a trusted proxy
   (`TRUST_PROXY` = the number of hops, so a CDN in front of nginx is `2`), or failing that a
   browser id the server signs with its session secret — a forged cookie fails the signature check,
   and an over-limit request is never given a new id. Counters live in memory, so move them to a
   shared store before running more than one process.
7. **Deadline and capacity checks use the server clock**; there is no per-event timezone yet.
8. **Delivery depends on a provider.** With no `RESEND_*`/`EMAIL_*` or `TWILIO_*`/`SMS_*` variables,
   email and text sends are recorded as `not-configured` and only the shared link path works.
   Provider bounces and undeliverable numbers are not reconciled back into the guest list.
9. **No security headers are set.** `next.config.mjs` does not send a Content-Security-Policy,
   `X-Content-Type-Options` or HSTS; add them in the Next config or at the proxy before
   publishing.

---

## 10. Verification performed

Automated (`npm run check`):

- `npx tsc --noEmit` — clean.
- `eslint .` — 0 errors. One warning remains (`react-hooks/exhaustive-deps` in
  `components/SeatingPlanEditor.tsx`), tracked rather than silenced.
- `vitest run` — 38 tests over the §4 reply rules (identity order, ambiguity, party size, clamping,
  clearing on decline, capacity boundaries, the disabled/past-deadline gates) and the share helpers.
- `npm run test:db` (Vitest, against a disposable `_test` database) — 15 route tests: the guest page
  answers an unknown id with a 404, a signed personal link gets its guest, pass and reply token,
  an unsigned or cross-invitation token does not, an anonymous visitor receives only the projected
  card (no guest list, emails or messages), and the RSVP endpoint returns 404 for an unknown id,
  403 for closed or past-deadline replies without touching the row, writes the row a signed link
  names, and creates a new row rather than claiming one from a bare guest id.

Manual and API checks (run against the local Postgres and the dev server):

- `GET /`, `/create` (redirect to a new id), `/i/<id>`, `/host/<id>` — all 200.
- `POST` RSVP (accept, plus-ones, note) → 200 and persisted; `POST` host guest → 200.
- `PUT` invitation with a changed title → 200, **guest list preserved (2 guests)**.
- `PATCH` guest status → 200.
- Link preview: `/i/<id>` served `og:`/`twitter:` tags with the event title, host and a clipped
  description; `/i/<id>/opengraph-image` returned a 1200×630 PNG for a red card, a pale card, a
  two-line title and an unknown id.
- Browser: card renders at 5:7 with all 8 lines inside the card and fonts applied; envelope renders
  at 1.52:1 with liner, stamp and name; drag moved a line 60×40 px → +15.3% / +7.3% (correct
  percentage maths) and triggered autosave; guest flow envelope → flap → card rising through the
  pocket notch (measured 157 px clear of the envelope top, card clipped by the pocket diagonals) →
  full card at 379×530 (5:7) with the envelope unmounted → page; opening sound schedules one noise
  buffer through one band-pass and is skipped entirely when muted (choice persisted across reloads);
  card motion: gallery shows 7 of 8 designs animated (Ink Minimal deliberately still) at 11–16
  particles each, the editor's "Card motion" control re-themes live and persists (confetti → null on
  "None"), the guest card paints all 11 leaves of Garden Trellis with text at z-index 2 above motion
  at 1, and the reduced-motion rule in the served CSS hides `.card-drift`; envelope rework: all 12
  Envelope-panel fields render (flap shape, paper texture, wax seal and seal wax are new);
  flap/texture/seal/seal-wax changes persist (`flat`, `grain`, `rosette`, `#7a2c3a`) and drive the
  stage preview; point, rounded and flat silhouettes plus laid and grain stock were each rendered and
  inspected on the guest page, as was the monogram seal (Gilded Arch) and rosette seal (Garden
  Trellis, Midnight Deco); a dark-design hint (`--hint-ink`) is now legible; `.ics` link generated;
  RSVP form and public guest list render; host dashboard shows 2 invited / 1 attending / 1 head / 50%
  replied with correct table rows; gallery shows 8 designs at 265×370.

Not verified: delivery through a live Resend/Twilio account, print output, cross-browser testing
beyond the enrolled Chromium, and mobile device testing beyond responsive CSS.
