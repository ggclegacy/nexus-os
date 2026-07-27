# Nexus OS

Nexus OS is a private personal command system. Calendar Phases 1–3 provide the
shared application foundation, responsive Command Center, and a functional
Today-first personal time system for typed events, priorities, routines,
advanced recurrence, persistent reminder lifecycles, planning views, briefs,
Rescue Mode, quiet hours, connected Google calendars, and reviewed Calendar
intelligence.

## Local development

Requirements:

- Node.js 22.13 or newer
- npm using the committed lockfile

Install and run:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`.

The development server uses a project-local Cloudflare D1 database. Command
Center and Calendar read from the same canonical priority, event, and routine
records under the ignored `.wrangler` directory. This is local development
persistence. Provider sync is available only after the optional server
configuration below and a completed OAuth flow.

To run an existing production build locally:

```sh
npm run build
npm run start
```

## Vercel deployment

The repository is also configured for a standard Next.js deployment on
Vercel. The Vercel build uses Turso/libSQL for the same SQLite data model that
the local Cloudflare build stores in D1. Hosted requests are denied unless the
single-owner access gate is configured.

1. Import `ggclegacy/nexus-os` into Vercel.
2. Add the Turso integration from the Vercel Marketplace to the project. It
   supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Add `NEXUS_ACCESS_USERNAME` and a long, unique
   `NEXUS_ACCESS_PASSWORD` to every hosted environment.
4. Add any optional Calendar integration values described below.
5. Deploy. `vercel.json` selects the verified `npm run build:vercel` build.

For a manually managed Turso database, add all four environment variables in
Vercel using `.env.example` as the reference. The application initializes an
empty database on the first authenticated API request.

`NEXT_PUBLIC_SITE_URL` is optional on Vercel because the production project URL
is available during the build. Set it on other hosts when you want absolute
Open Graph and social-preview URLs to use a custom domain.

The access gate intentionally allows `localhost`, `127.0.0.1`, and `::1`
without credentials for local development. It uses HTTP Basic authentication
over the hosting provider's HTTPS connection, is suitable for this
single-owner release, and is not a multi-user identity or sharing system.

To exercise the Vercel runtime locally, omit `TURSO_DATABASE_URL` to use the
ignored `local.db` file:

```sh
npm run dev:vercel
npm run test:rendered:vercel
```

## Calendar Phase 3 configuration

Phase 3 is capability-gated. Missing credentials do not create placeholder
connections or simulated AI: Calendar keeps its local views, rule-based briefs,
structured search, deterministic availability, capture parser, Plan My Day,
and evidence-backed insights.

For Google Calendar:

1. Enable the Google Calendar API and create a Web application OAuth client.
2. Register
   `https://your-domain.example/api/calendar/google/callback` as an authorized
   redirect URI. For local testing, register the matching localhost URI.
3. Set `GOOGLE_CALENDAR_CLIENT_ID`,
   `GOOGLE_CALENDAR_CLIENT_SECRET`, `NEXUS_OAUTH_STATE_SECRET`, and
   `NEXUS_CREDENTIAL_ENCRYPTION_KEY` from `.env.example`.
4. Open Calendar → Intelligence → Connected and complete the provider consent
   flow.

Nexus requests Google account identity, calendar-list read access, and event
read/write access. Tokens are encrypted before storage. The current deployment
foundation has no background job runner, so synchronization is incremental and
user-triggered through Sync now. Nexus never reports a provider change as
synced before Google confirms it.

For Atlas language and structured capture, set `OPENAI_API_KEY`. The optional
`NEXUS_ATLAS_MODEL` defaults to `gpt-5.6-sol`. Requests use the Responses API
with strict structured output and `store: false`; the application validates
the result again before showing a proposal. Model access is not required for
the deterministic Calendar workflows.

Google organizer, attendee, response, and provider-native meeting context are
displayed, but invitation response actions are intentionally omitted until the
complete confirmed-send flow exists. Weather, routing, attachment analysis,
Microsoft, Apple/CalDAV, and unbuilt Nexus domain modules are likewise omitted
until a secure, configured service or module exists.

## Verification

```sh
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run test:accessibility
npm run test:e2e
npm run build
npm run test:rendered
npm run test:rendered:vercel
```

Generate a migration after changing `db/schema.ts`:

```sh
npm run db:generate
```

## Current scope

Command and Calendar are functional. Calendar opens on a Today workspace with
time awareness, attention and upcoming queues, typed Quick Add defaults, event
details, rescheduling, safe recurring scope, payment/completion state, and
reload persistence. Agenda, Week, Month, Reminder Center, Birthday Planning,
Bill Planning, deterministic briefs, and Rescue Mode are available from the
Calendar workspace. Phase 3 adds provider-neutral sources, Google OAuth and
manual incremental sync, sync health and conflict resolution, previewed natural
language capture, grounded Calendar questions, deterministic Find Time and Plan
My Day, sensitive-event controls, audit/undo, and evidence-backed insights.
Other destinations intentionally show an honest not-built-yet state until
their approved roadmap phases are implemented.
