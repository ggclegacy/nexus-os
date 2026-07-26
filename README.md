# Nexus OS

Nexus OS is a private personal command system. Phase 1 provides the shared
application foundation, responsive shell, and functional Command Center.

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
Center priorities, timeline items, and quick captures persist locally under the
ignored `.wrangler` directory. This is local development persistence, not cloud
sync.

To run an existing production build locally:

```sh
npm run build
npm run start
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
```

Generate a migration after changing `db/schema.ts`:

```sh
npm run db:generate
```

## Current scope

Command is functional. Other destinations intentionally show an honest
not-built-yet state until their approved roadmap phases are implemented.
