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

One command checks the repo:

```bash
npm run check      # tsc --noEmit && eslint . && vitest run
npm run lint       # ESLint only (next/core-web-vitals)
npm test           # the reply-rule tests only
```

The suite covers the §4 rules in `lib/rsvp-rules.ts` — reply identity, party size, clamping,
capacity and the deadline gate. It imports the rules directly, so it needs no server and no
database.

## Where things are

| Path | What |
| --- | --- |
| `/` | Design gallery + saved invitations |
| `/create` | Editor — design, text, colours, envelope, backdrop, details, RSVP settings, page style, blocks |
| `/i/<id>` | What a guest sees: envelope → card → event page → RSVP |
| `/host/<id>` | Guest list, replies, headcount, CSV export |
| `/host/<id>/checkin` | Door screen: scan or type a pass, undo, walk-ins |
| `/host/<id>/checkin/report` | Printable check-in report |
| `/host/<id>/seating` | Seating plan editor |
| `/app/*` | Phone-shaped app shell: designs, create, editor, guests, seating, account |
| `/signin`, `/reset` | Accounts and password reset |
| `lib/types.ts` | The whole data model |
| `lib/designs.ts` | The design catalogue and its palettes |
| `lib/motifs.tsx` | Original decorative SVG artwork |
| `lib/defaults.ts` | Sample wording and invitation factory |
| `lib/store.ts` | Postgres store — one document row per invitation |
| `lib/rsvp-rules.ts` | Reply identity, party size, capacity and deadline rules (pure, tested) |
| `lib/checkin.ts` | Pass codes, scan parsing and door headcounts |
| `lib/reminders.ts` | Scheduled RSVP nudges, with a claim so a send never doubles |
| `tests/` | Vitest tests for the §4 rules |
| `eslint.config.mjs` | Flat ESLint config (`next/core-web-vitals`) |
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

### Local database

For local testing the repo can carry its own PostgreSQL, so nothing leaves the machine. The server
binaries live in `.localdb/` (git-ignored) and listen on `127.0.0.1:5544`:

```bash
npm run db:use:local    # .env DATABASE_URL → postgresql://postgres@127.0.0.1:5544/gatherly
npm run db:use:neon     # .env DATABASE_URL → the saved # NEON_DATABASE_URL line
npm run db:local:start  # start on 127.0.0.1:5544 by hand (npm run dev does this itself)
npm run db:local:stop   # stop; data stays in .localdb/data
```

Photos uploaded before the editor started downscaling them are still stored at camera size.
`npm run db:shrink-images` re-encodes those inline pictures in place (1400px on the long edge,
within a 300 kB budget, `--dry-run` to preview), which is what makes an old invitation as light
as a new one. It bumps each rewritten invitation's `updatedAt` so the photo route's cache-busting
version changes; that also moves it to the top of the "recently edited" order.

`npm run dev` starts the bundled server when nothing is listening on port 5544, and carries on
untouched when `.localdb/` is absent. `.localdb/postgres.log` holds the server log, and the Neon
connection string stays in `.env` as a commented `# NEON_DATABASE_URL=` line, so the two switches
never lose it. Both are idempotent, and either one needs a server restart to take effect.

Copying data between the two databases is four commands, no ad-hoc scripts:

```bash
npm run db:use:neon     # read from the hosted database
npm run db:export       # → .data/export/{invitations.json,users.json,session-secret}
npm run db:use:local    # write into the local one
GATHERLY_DATA_DIR=.data/export npm run db:import-users
GATHERLY_DATA_DIR=.data/export npm run db:import
```

`db:export` prints those last two lines for you, and takes an optional directory
(`npm run db:export -- /some/dir`). Both imports only **add** rows that are missing, so re-running
them never overwrites edits made on the target; `.data/export/` holds password hashes and the
session key, so treat it like `.env` and delete it when you are done.

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
trusting the declared type; keys are scoped `invitations/<owner>/<random>.<ext>`. Replacing a photo
or deleting an invitation removes the old object once no invitation still references it, and only
URLs under `S3_PUBLIC_BASE_URL` are ever deleted. With none of those settings the endpoint answers
503 and the editor falls back to inlining images as data URLs, so a bare checkout still works.
Invitations created before this change keep their data URLs.

Images uploaded and never saved still leave an object behind. A sweep lists the objects under
`invitations/` that no invitation references, removes them, and records each run — with the keys it
deleted — in the `job_runs` table.

```bash
SWEEP_INTERVAL_MINUTES=1440   # how often the scheduler sweeps
CRON_SECRET=…                 # required by the endpoint, the scheduler and the CLI
```

Three ways to run it, all using the same code:

- **Companion process:** `npm run scheduler` sweeps immediately and then every
  `SWEEP_INTERVAL_MINUTES`, logging each key it removes. Run it beside the app (systemd, PM2, a
  second container). Overlapping runs are refused by a transaction-scoped advisory lock, because
  this database is reached through a transaction pooler where session locks do not exclude.
- **From a scheduler:** `POST /api/jobs/sweep-images` with `Authorization: Bearer $CRON_SECRET` and
  `{"delete": true}` — for hosts that provide their own cron.
- **By hand:** `npm run db:sweep-images`, which calls the endpoint on `APP_URL` (default
  `http://127.0.0.1:3210`).

Nothing is removed unless `--delete` (or `"delete": true`) is passed, and objects modified within
the last 24 hours are always kept, so a sweep cannot race an upload being saved.

`job_runs` keeps `JOB_RUNS_RETENTION_DAYS` (default 30) of history; each sweep prunes anything
older, and the row it just wrote is never pruned.

## Sending updates

Email and text go out through a provider; this app never runs a mail server.

```bash
# email — Resend, or any JSON gateway
RESEND_API_KEY=…
EMAIL_FROM=Gatherly <hello@example.com>
# or
EMAIL_API_URL=https://…
EMAIL_API_KEY=…
EMAIL_FROM=…

# text — Twilio, or any JSON gateway
TWILIO_ACCOUNT_SID=…
TWILIO_AUTH_TOKEN=…
TWILIO_FROM_NUMBER=+1…
# or
SMS_API_URL=https://…
SMS_API_KEY=…
SMS_FROM=+1…
```

With none of these set the dashboard still composes a message and records the attempt as
`not-configured`, naming the variables it needs; nobody is messaged and the shared link keeps
working.

Texts only reach guests who gave a number **and** ticked consent. RSVP reminders (pending, maybe or
all guests) are stored on the invitation and sent when a host presses “Send due reminders” or “Send
now” — opening the dashboard or prefetching it never sends anything. A reminder is claimed before
it is sent, so two tabs cannot message everyone twice; a crashed send’s claim expires after 15
minutes. The scheduler below sweeps images only; it does not send reminders.

## Deployment

The app and the scheduler are separate processes, and both want a supervisor:

```bash
# systemd
sudo cp deploy/gatherly-scheduler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gatherly-scheduler
journalctl -u gatherly-scheduler -f

# or PM2
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup
pm2 logs gatherly-scheduler
```

The unit assumes the app lives in `/srv/gatherly` and runs as the `gatherly` user; adjust those to
the host. `.env` must stay mode `0600` — it holds `DATABASE_URL` and `CRON_SECRET` — and the
scheduler reads the same file the app does. It execs `node` directly rather than `npm run`, so the
scheduler is the unit's main process and `systemctl stop` reaches it with SIGTERM.

Before the first start: `npm ci && npm run build && npm run db:migrate`, with `NODE_ENV=production`
so session cookies are marked `secure` (which means the app must be reached over HTTPS).

Point the load balancer at `GET /api/health`: it answers `200 {"status":"ok","database":"up",…}`
when the pool can run a query and `503 {"status":"degraded","database":"down"}` when it cannot. The
response is `no-store`, the probe gives up after four seconds, and the underlying error goes to the
server log rather than the response body.

## How the card scales

Text sizes are stored in percent of card width and rendered with CSS container query units. The same
invitation therefore looks identical as a 265 px gallery thumbnail, a 392 px editor canvas and a
400 px guest card, and dragging a line stores percentages rather than pixels.

## Before publishing

Read §7–§9 of `REQUIREMENTS.md`. At minimum: point uploads at a real bucket and migrate the images
still inlined as data URLs, move the in-memory rate-limit counters to a shared store, add the
security headers `next.config.mjs` does not set (CSP, `X-Content-Type-Options`, HSTS) at the proxy
or in the Next config, run `npm run check` in CI, and run `npm run db:migrate` as part of every
deploy.

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
