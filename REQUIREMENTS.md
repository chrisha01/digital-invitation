# Gatherly — requirements & functionality

An online-stationery app: a host designs a card, dresses an envelope, publishes a guest page and
collects RSVPs. This document is the functional spec the build targets. It was written after
reviewing how Paperless Post describes its own workflow (design → envelope/liner/stamp → backdrop →
event details → page style → blocks → RSVP settings). All artwork, copy, palettes and fonts here are
original; no Paperless Post assets, code or text are used.

Status legend: **[built]** implemented and exercised in this repo · **[spec]** specified but not
implemented here.

---

## 1. Personas

| Persona | Needs |
| --- | --- |
| **Host** | Design an invitation quickly, control every visual detail, know who is coming, chase replies, export a list. |
| **Guest** | Open something that feels like mail, understand the details in one screen, reply in under a minute. |

---

## 2. Core flows

1. **Start** — browse eight designs (`/`), pick one, land in the editor with sample wording.
2. **Customize** — card text, type, colours, artwork, border, photo, envelope, liner, stamp, backdrop.
3. **Describe** — event title, host, start/end, venue, address, description, dress code.
4. **Configure replies** — toggle RSVPs, public guest list, plus-ones, adults/children headcount,
   capacity, deadline, custom questions.
5. **Style the page** — page background, text, accent, heading/body fonts.
6. **Add context** — blocks: notes, schedules, links (registry, travel).
7. **Invite** — add guests by name/email/group; copy a shared link or a personal link per guest.
8. **Guest opens** — envelope with their name → flap opens → card → "Open the invitation" → page.
9. **Reply** — accept / decline / maybe, plus party size, answers, note to hosts.
10. **Track** — dashboard stats, table of replies, notes, CSV export, manual status overrides.

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
| D7 | Each design carries its own card motion — falling leaves, drifting petals, confetti, gilt sparkle or dust motes — drawn in the card's own ink and accent. A design can deliberately have none. |
| D8 | Motion is switchable independently of the design (five kinds plus "none") and animates on the card everywhere it appears: the envelope peek, the card stage, the gallery and the editor. It is pure CSS — no images, no scripts — and stays behind the words. |
| D9 | With `prefers-reduced-motion: reduce`, the card motion is not rendered at all. |

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
| E16 | Sound toggle stays mounted during open (only hidden via `visibility: hidden`) so the envelope stage geometry stays consistent and the envelope never drops/shrinks when the scrollbar toggles. | |

### 3.5 Backdrop **[built]**

| # | Requirement |
| --- | --- |
| B1 | Patterns: plain, paper grain, linen, gradient, confetti, sunburst; two colours. |
| B2 | Upload your own image to replace the pattern (PNG/JPEG/WebP; 3.5 MB cap). |
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

### 3.7 RSVP & guest management **[built]**

| # | Requirement |
| --- | --- |
| R1 | Collect RSVPs is a switch; off means the page is informational only. |
| R2 | Replies: joyfully accept, regretfully decline, maybe. |
| R3 | Plus-ones allowed up to a host-set maximum; ignored when the guest declines. |
| R4 | Optional separate adult/child headcount. |
| R5 | No plus-one field is shown when the headcount is enabled — party size is expressed once, not twice. |
| R6 | Capacity is enforced server-side; a reply that would exceed it is rejected with a clear message. |
| R7 | RSVP deadline is enforced server-side; after it, the form is replaced by a closed notice. |
| R8 | Host-defined questions (text) with required flags; answers are stored per guest and shown to the host. |
| R9 | Guests can leave a note for the hosts. |
| R10 | One reply per guest: an existing guest is matched by personal link, then email, then name. |
| R11 | Host can add guests (name, email, group), change any reply status, and remove a guest. |
| R12 | Headcount = party size of attending guests, never double-counting plus-ones. |
| R13 | Per-guest personal links (`/i/<id>?g=<guestId>`) prefill the name and envelope. |
| R14 | CSV export of the guest list with replies, party size and notes. |

---

## 4. Business rules (implemented)

1. **Design saves never own guest data.** `PUT /api/invitations/:id` replaces design, details and
   settings but copies the server's guest list verbatim, so an open editor cannot erase replies.
2. **Reply identity order:** personal link → email match → exact name match → new guest.
3. **Capacity** compares existing attending headcount (excluding the replying guest) plus the new
   party size against `settings.capacity`. Over-capacity returns HTTP 409 and writes nothing.
4. **Deadline and disabled RSVPs** return HTTP 403 and write nothing.
5. **Plus-ones** are clamped to `maxPlusOnes`; headcount values are clamped to 0–20 (adults ≥ 1).
6. **Declining clears the party size** so a later "yes" cannot inherit stale counts.
7. **Motif switch is independent** of design switch; border and colours survive motif changes.
8. **Guest text is stored and rendered as text**, never as HTML — React escapes it.

---

## 5. Data model (see `lib/types.ts`)

```
Invitation
├─ id, designSlug, title, subject, createdAt, updatedAt
├─ card      { background, ink, accent, motif, border, borderColor, photo, photoOpacity,
│              layers[]: { name, text, font, size, color, weight, italic, uppercase,
│                          tracking, lineHeight, align, x, y, width, visible } }
├─ envelope  { enabled, color, linerPattern, linerColor, linerColor2, stamp, stampColor,
│              font, returnAddress }
├─ backdrop  { pattern, color1, color2, image }
├─ event     { title, host, startsAt, endsAt, location, address, description, dressCode }
├─ settings  { collectRsvp, showGuestList, allowPlusOnes, maxPlusOnes, capacity,
│              deadline, headcount, questions[] }
├─ page      { background, text, accent, fontBody, fontHeading }
├─ blocks[]  { type: note|schedule|link, title, body, url }
└─ guests[]  { name, email, tag, status, plusOnes, adults, children, answers, message, respondedAt }
```

Sizes are **percentages of card width/height**, not pixels — this is what makes the same invitation
render identically in a 265 px gallery thumbnail, a 392 px editor canvas and a 400 px guest card.

---

## 6. Interface

| Route | Purpose |
| --- | --- |
| `/` | Design gallery, saved invitations. |
| `/create?design=` / `/create?id=` | Editor (creates an invitation on first visit). |
| `/i/<id>[?g=<guestId>]` | Guest experience: envelope → card → page → RSVP. |
| `/host/<id>` | Guest list, stats, status changes, CSV. |
| `GET/POST /api/invitations` | List / create. |
| `GET/PUT/DELETE /api/invitations/<id>` | Load / autosave / delete. |
| `POST /api/invitations/<id>/rsvp` | Guest reply. |
| `POST/PATCH/DELETE /api/invitations/<id>/guests` | Host-side guest list. |

---

## 7. Non-functional requirements

**[built]** Responsive down to 375 px (editor stacks, gallery goes two-up, page is single column).
Autosave on a 650 ms debounce, with a visible saved/saving/not-saved state.
Keyboard-reachable controls with visible focus; every form control labelled.
Fonts loaded once from Google Fonts with system fallbacks.

**[spec]** Authentication and per-account isolation; object storage for uploaded images; rate
limiting and spam protection on the public RSVP endpoint; payment for premium elements; print;
audit log of answer changes; undo/redo; concurrent-edit conflict resolution; localisation.

---

## 8. Deliberately out of scope

These are Paperless Post features that this build does **not** include, because they need
infrastructure or commercial agreements rather than design work:

- Accounts, teams, CRM sync, guest tags/segments beyond a simple group string.
- Bounce, open and delivery-event tracking. Texts and emails go out through a provider (Twilio or
  a JSON SMS gateway; Resend or a JSON email gateway) and the app only records the counts each API
  call returns, so invitations still work as plain shared links when no provider is connected.
- Coins/premium gating and paid print fulfilment.
- AI "magic" artwork and sticker generation, comment walls, check-in QR codes.
- Real-time collaboration in the editor.

---

## 9. Known limitations

1. **Everything lives in Postgres.** Invitations and replies (including guests, replies, seating,
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
3. **Guest identity is name/email based**, so a reply can overwrite a same-named guest. Personal
   links are the reliable path; production needs signed, single-purpose tokens.
4. **Uploads are half-moved.** With `S3_*` configured, images go to object storage and the document
   keeps a URL; without it the editor still inlines data URLs, and every invitation made before the
   change keeps the bytes it already has. Replaced images and the images of a deleted invitation are
   removed from the bucket once no invitation references them, but nothing migrates the old inline
   data URLs — add a sweep before taking real uploads.
5. **Rate limits are per process, and callers are identified per browser.** Sign-in, sign-up,
   password reset and the public RSVP endpoint are throttled in `lib/rate-limit.ts`. The key is the
   address reported by a trusted proxy (`TRUST_PROXY` = the number of hops, so a CDN in front of
   nginx is `2`), or failing that a browser id the server signs with its session secret — a forged
   cookie fails the signature check, and an over-limit request is never given a new id. Callers with
   no id share one token bucket whose refill rate equals the route's own rate, so a starved pool
   recovers gradually without raising long-run throughput; a newly issued id serves its first minute
   on a five-request probation, so farming ids cannot buy a fresh pool. Move the counters to a
   shared store once the app runs on more than one process.
6. Deadline and capacity checks use the server clock; there is no timezone per event yet.

---

## 10. Verification performed

- `npx tsc --noEmit` — clean.
- `GET /`, `/create` (redirect to a new id), `/i/<id>`, `/host/<id>` — all 200.
- `POST` RSVP (accept, plus-ones, note) → 200 and persisted; `POST` host guest → 200.
- `PUT` invitation with a changed title → 200, **guest list preserved (2 guests)**.
- `PATCH` guest status → 200.
- Browser: card renders at 5:7 with all 8 lines inside the card and fonts applied; envelope renders
  at 1.52:1 with liner, stamp and name; drag moved a line 60×40 px → +15.3% / +7.3% (correct
  percentage maths) and triggered autosave; guest flow envelope → flap → card rising through the
  pocket notch (measured 157 px clear of the envelope top, card clipped by the pocket diagonals) →
  full card at 379×530 (5:7) with the envelope unmounted → page; opening sound schedules one noise
  buffer through one band-pass and is skipped entirely when muted (choice persisted across reloads);
  card motion: gallery shows 7 of 8 designs animated (Ink Minimal deliberately still) at 11–16 particles
  each, the editor's "Card motion" control re-themes live and persists (confetti → null on "None"), the
  guest card paints all 11 leaves of Garden Trellis with text at z-index 2 above motion at 1, and the
  reduced-motion rule in the served CSS hides `.card-drift`; envelope rework: all 12 Envelope-panel fields
  render (flap shape, paper texture, wax seal and seal wax are new); flap/texture/seal/seal-wax changes
  persist (`flat`, `grain`, `rosette`, `#7a2c3a`) and drive the stage preview; point, rounded and flat
  silhouettes plus laid and grain stock were each rendered and inspected on the guest page, as was the
  monogram seal (Gilded Arch) and rosette seal (Garden Trellis, Midnight Deco); a dark-design hint
  (`--hint-ink`) is now legible; `.ics` link
  generated; RSVP form and public guest list render; host dashboard shows 2 invited / 1 attending /
  1 head / 50% replied with correct table rows; gallery shows 8 designs at 265×370.

Not verified: email delivery (not implemented), print output (not implemented), cross-browser
testing beyond the enrolled Chromium, and mobile device testing beyond responsive CSS.
