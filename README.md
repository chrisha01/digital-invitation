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

Point `GATHERLY_DATA_DIR` at another directory to run against a throwaway store instead — handy for
trying something (a burst of test replies, say) without touching the real guest list.

## How the card scales

Text sizes are stored in percent of card width and rendered with CSS container query units. The same
invitation therefore looks identical as a 265 px gallery thumbnail, a 392 px editor canvas and a
400 px guest card, and dragging a line stores percentages rather than pixels.

## Before publishing

Read §7–§9 of `REQUIREMENTS.md`. At minimum: move the store to a real database, move uploads to
object storage, and move the in-memory rate-limit counters to a shared store.

Password resets are emailed when a mail provider is configured (`RESEND_API_KEY` + `EMAIL_FROM`).
With no provider the link is only returned in development — production never hands it back.

## Behind a proxy

Rate limits never trust `X-Forwarded-For` on its own: a client writes that header itself. By default
the key is a browser id this server signs with its session secret, handed out by the limited
endpoints, so an invented cookie is ignored.

Behind a proxy, set `TRUST_PROXY` to **the number of hops in front of the app** — each one appends
the address it saw, so the guess is counted in from the right:

| Setup | `TRUST_PROXY` |
| --- | --- |
| App exposed directly | unset |
| nginx / a load balancer in front | `1` |
| Cloudflare (or any CDN) in front of nginx | `2` |

With `2`, a chain of `client, cdn-edge` resolves to the guest rather than the CDN edge. Make sure the
outermost proxy overwrites, rather than passes through, a client-supplied `X-Forwarded-For`.

Callers with no id yet share one pool. It is a token bucket that refills at the route's own rate —
the full allowance arrives as one burst, then one slot at a time across the window — so a starved
pool recovers on its own without ever letting more through, over time, than the route allows.
A freshly issued id is on probation for its first minute (five requests), so a script cannot farm
ids to dodge the shared pool.
