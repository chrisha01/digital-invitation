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
| `lib/store.ts` | Postgres store — one document row per invitation |
| `db/migrations/` | SQL migrations, applied in order |
| `lib/auth.ts` | Accounts, password hashing, signed session cookies |
| `components/` | Editor, card renderer, envelope, guest view, RSVP form, host dashboard |

## Data

Invitations, replies, accounts and the session signing key all live in Postgres: one document per
invitation in the `invitations` table, password hashes in `users`, and the cookie key in
`app_settings` so every instance signs and verifies the same sessions. Put your connection string in
`.env`:

```bash
DATABASE_URL=postgresql://…
npm run db:migrate         # create or upgrade the tables
npm run db:import          # one-off: copy .data/invitations.json in
npm run db:import-users    # one-off: copy .data/users.json and the session secret in
```

Both imports only **add** rows the database does not already have. An id or email that is already
present is skipped and left exactly as it is, so re-running an import can never roll back edits made
since — they bring a fresh database up to date, they do not sync backwards. Invitation writes go
through a transaction that locks the row, so two requests editing the same invitation cannot lose
each other's changes.

`db:import-users` also carries over `.data/session-secret`, and only when that key is not already in
`app_settings`; that is what keeps the cookies already in people's browsers valid across the move.
The `.data/` files are now read by those two import scripts and nothing else — the app itself never
touches them. `GATHERLY_DATA_DIR` still points the imports somewhere else.

### Images

Uploads go to S3-compatible object storage through `POST /api/uploads`, and the invitation keeps
the returned URL instead of the image bytes. Any S3 API works; these are the R2 settings, and for
AWS S3 you leave the endpoint and region overrides out:

```bash
S3_BUCKET=gatherly
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_BASE_URL=https://cdn.example.com              # how the bucket is served
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com  # R2 only
S3_REGION=auto                                          # R2 only
```

Uploads are signed-in only, capped at 3.5 MB, rate limited, and the bytes are sniffed rather than
trusting the declared type; keys are scoped `invitations/<owner>/<random>.<ext>`. With none of
those settings the endpoint answers 503 and the editor falls back to inlining images as data URLs,
so a bare checkout still works. Invitations created before this change keep their data URLs.

## How the card scales

Text sizes are stored in percent of card width and rendered with CSS container query units. The same
invitation therefore looks identical as a 265 px gallery thumbnail, a 392 px editor canvas and a
400 px guest card, and dragging a line stores percentages rather than pixels.

## Before publishing

Read §7–§9 of `REQUIREMENTS.md`. At minimum: point uploads at a real bucket and migrate the images
still inlined as data URLs, move the in-memory rate-limit counters to a shared store, and run
`npm run db:migrate` as part of every deploy.

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
