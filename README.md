# Gatherly

An online-invitation studio: design a card, dress the envelope, publish a guest page, collect RSVPs.
Built as an original implementation of the paper-stationery workflow — no third-party artwork, code
or copy.

Full functional spec, business rules and known limitations: **[REQUIREMENTS.md](./REQUIREMENTS.md)**.

## Run it

```bash
npm install
npm run dev        # http://localhost:3210
```

Production build:

```bash
npm run build && npm start
```

## Where things are

| Path | What |
| --- | --- |
| `/` | Design gallery + saved invitations |
| `/create` | Editor — design, text, colours, envelope, backdrop, details, RSVP settings, page style, blocks |
| `/i/<id>` | What a guest sees: envelope → card → event page → RSVP |
| `/host/<id>` | Guest list, replies, headcount, CSV export |
| `/host/<id>/checkin` | Door screen: scan or type a pass, undo, walk-ins |
| `/host/<id>/seating` | Seating plan editor |
| `lib/types.ts` | The whole data model |
| `lib/designs.ts` | The design catalogue and its palettes |
| `lib/motifs.tsx` | Original decorative SVG artwork |
| `lib/defaults.ts` | Sample wording and invitation factory |
| `lib/store.ts` | File-backed store, serialised writes |
| `lib/auth.ts` | Accounts, password hashing, signed session cookies |
| `components/` | Editor, card renderer, envelope, guest view, RSVP form, host dashboard |

## Data

Invitations and replies live in `.data/invitations.json` (git-ignored). Delete that file to start
fresh — the app recreates it on the next write. Accounts and the session secret live beside it in
`.data/users.json` and `.data/session-secret`.

## How the card scales

Text sizes are stored in percent of card width and rendered with CSS container query units. The same
invitation therefore looks identical as a 265 px gallery thumbnail, a 392 px editor canvas and a
400 px guest card, and dragging a line stores percentages rather than pixels.

## Before publishing

Read §7–§9 of `REQUIREMENTS.md`. At minimum: move the store to a real database, move uploads to
object storage, and move the in-memory rate-limit counters to a shared store.

Password resets are emailed when a mail provider is configured (`RESEND_API_KEY` + `EMAIL_FROM`).
With no provider the link is only returned in development — production never hands it back.
