# Nexus OS

Nexus OS is a private personal command system. Phases 1 and 2 provide the
shared application foundation, responsive Command Center, and a functional
Today-first personal time system for typed events, priorities, routines,
advanced recurrence, persistent reminder lifecycles, planning views, briefs,
Rescue Mode, and quiet hours.

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
persistence, not cloud sync. Calendar states this boundary explicitly; no
external provider is connected.

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
4. Deploy. `vercel.json` selects the verified `npm run build:vercel` build.

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
Calendar workspace. Other destinations intentionally show an honest
not-built-yet state until their approved roadmap phases are implemented.
