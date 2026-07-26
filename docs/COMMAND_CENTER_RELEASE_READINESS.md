# Command Center release readiness

**Hardening date:** July 26, 2026  
**Scope:** Command Center and Personal Time (Today-first Calendar, typed events,
priorities, routines, reminders, and shared persistence)  
**Disposition:** Ready for the owner's final visual review; no deployment was
performed

## Initial baseline

The Phase 1–2 baseline built successfully for both Cloudflare/Vinext and
Vercel/Next, passed formatting, strict type checking, lint, 30 Vitest tests, 2
empty-state accessibility checks, 12 component workflow checks, rendered-route
checks, and the production dependency audit. The protected emblem hash was
`e77502c093ca5d7b8994aa13fee310ef8e8a5cab4c4b6a3f33dbdec5d1a9ae4c`.

The audit reproduced these release risks:

- restoring a completed top priority could exceed the top-three invariant;
- ordinary priorities could appear in Command's top-three surface;
- priority undo recreated a record instead of restoring its identity;
- reminder replacement and routine occurrence creation had interruption/race
  windows;
- create requests had no retry idempotency;
- boolean and enum inputs could be coerced or silently defaulted, long text was
  silently truncated, invalid dates/ranges were accepted, and malformed or
  oversized JSON was not bounded;
- hosted routes had no trusted single-owner access boundary.

## Issues fixed

### Correctness and data integrity

- Top-three create, promote, restore, and reorder operations are enforced in
  SQL against the active, unarchived set. Stale reorder sets now return a
  conflict instead of silently overwriting newer state.
- Command renders only records explicitly marked as top priorities.
- Priority delete is a soft archive; undo clears the archive marker and
  preserves the original ID, timestamps, notes, focus window, and reminders.
- Reminder replacement is one database batch with deterministic reminder IDs.
- Routine occurrence changes use a unique-key upsert, preserving one history
  row per routine/date under repeated or concurrent writes.
- Event, priority, routine, timeline, and capture creates accept a validated
  idempotency key as their record ID. The client retries an interrupted POST
  once with the same key.
- Server validation rejects coercive booleans, invalid enums, impossible dates,
  inverted or excessively broad ranges, overlong text, invalid content types,
  malformed JSON, and request bodies over 64 KiB.

### Reliability and recovery

- Recoverable form failures continue to leave component input intact.
- Command's independent surface composition and truthful partial/offline/error
  states remain intact.
- Interrupted creates are retry-safe; optimistic priority changes keep their
  existing rollback behavior.
- Conflict errors are explicit HTTP 409 responses; forbidden writes are 403;
  boundary validation is 400.

### Accessibility

- Automated axe coverage now includes populated Command, the priority-edit
  dialog, populated Calendar agenda, and empty states.
- Workflow coverage exercises keyboard-accessible controls, dialog behavior,
  focus-safe undo, and the agenda alternative to calendar grids.
- Existing landmarks, skip navigation, labels, live regions, visible focus,
  reduced-motion CSS, reflow rules, and minimum target tokens were retained.

### Privacy and security

- Non-local requests require configured single-owner credentials. Missing
  hosted configuration fails closed with 503; invalid credentials return 401.
- Cross-site mutations are rejected before reaching API handlers.
- Responses add CSP, frame denial, MIME sniffing protection, no-referrer,
  no-index, permissions policy, opener isolation, and HSTS headers.
- Secrets are environment-only; `.env.example` contains placeholders.
- Tests use a disposable synthetic libSQL database. No production or user data
  was modified.

## Data and migration status

Command hardening required no migration. Calendar Phase 1 adds one
`event_metadata` JSON-text column to canonical `timeline_items`; the generated
migration is additive and contains no table replacement, row deletion, or
canonical-store rewrite. Runtime schema initialization remains idempotent and
older rows receive backward-compatible event defaults.

Canonical records are preserved: priority removal now archives instead of
deleting, recurring-event exceptions stay additive, routine occurrence history
keeps its stable unique identity, and legacy routine migration remains
idempotent. The disposable verification database was isolated under
`/private/tmp`; repository-local user stores were not used for mutation tests.

## Final verification

The supported checks passed on July 26, 2026:

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`: 9 files, 49 tests
- `npm run test:accessibility`: 1 file, 4 tests, no axe violations
- `npm run test:e2e`: 2 files, 15 workflow tests
- `npm run build`: Cloudflare/Vinext production build
- `npm run build:vercel`: Next.js 16.2.12 production build plus Proxy
- `npm run test:rendered`
- `npm run test:rendered:vercel`
- `npm audit --omit=dev`: zero known production vulnerabilities
- `git diff --check`
- protected-emblem SHA-256 and dimensions check
- prohibited purple/texture implementation scan

Disposable production-runtime checks also passed:

- unauthenticated hosted request: 401;
- authenticated hosted request: 200;
- cross-site mutation: 403;
- malformed/non-JSON request: 400;
- repeated create with one idempotency key: same record ID;
- fourth active top priority and over-capacity restore: 409;
- archive/undo: same ID and original creation timestamp;
- repeated routine occurrence update: same occurrence ID and latest state.

The Calendar persistence check additionally created a synthetic financial
event with four reminders, reloaded it, marked it paid and completed, and
reloaded it again with every metadata field intact.

## Performance evidence

Warm local Next production responses against the disposable database were:

| Surface      | Start transfer |   Total | Response bytes |
| ------------ | -------------: | ------: | -------------: |
| Command      |        20.6 ms | 20.8 ms |         38,403 |
| Calendar     |        10.2 ms | 10.3 ms |         51,313 |
| Command API  |         9.3 ms |  9.8 ms |          2,270 |
| Calendar API |        16.3 ms | 16.9 ms |          2,665 |

Current Vinext client assets are 79,581 bytes raw for Calendar, 26,026 bytes
for Command, 54,428 bytes for the shared shell, and 61,264 bytes for CSS.
Calendar range queries are capped at 94 days, SQL result sets are bounded, and
recurrence expansion remains bounded by tested range/count limits.

Field-quality LCP, INP, and CLS were not measured because no in-app browser
backend was available in this workspace session. The budgets remain LCP
≤2.5 s, INP ≤200 ms, and CLS ≤0.10 and should be confirmed on the eventual
hosted candidate with production telemetry or a controlled lab run.

## Known limitations

- Final subjective visual/device inspection belongs to the owner.
- Live viewport, zoom, screen-reader, and tab-order browser automation could
  not run because the connected browser backend reported no available browser.
  Component keyboard tests, axe checks, semantic rendered-output checks, and
  responsive CSS inspection passed, but these do not replace device review.
- The access gate is intentionally single-owner HTTP Basic authentication over
  provider HTTPS. It has no multi-user accounts, sessions, record ownership, or
  sharing ACLs; those require a later identity phase.
- Offline behavior is truthful failure/retry and input retention, not an
  offline mutation queue. Unsaved form input does not survive a full page
  reload.
- Reminders are deterministic in-app reminders only. There is no background
  push, email, SMS, external calendar sync, or service-worker delivery.
- The full development dependency graph still reports the upstream ESLint
  `brace-expansion` advisory; `npm audit --omit=dev` is clean.

## Required configuration and exact run instructions

Use Node.js 22.13 or newer:

```sh
cd /Users/neil/Desktop/nexus-os
npm ci
npm run dev
```

Open `http://localhost:3000`.

For the local Vercel-compatible runtime:

```sh
cd /Users/neil/Desktop/nexus-os
cp .env.example .env.local
# Set TURSO_* when not using local.db, and replace both NEXUS_ACCESS_* values.
npm run dev:vercel
```

Localhost bypasses the access prompt. Any hosted environment must define
`NEXUS_ACCESS_USERNAME` and a long unique `NEXUS_ACCESS_PASSWORD` or it fails
closed.

## Owner visual-review checklist

- Overall obsidian/green/gold balance and restrained gold
- No purple, grain, patina, muddy bronze, or old-world appearance
- `icon.png` clarity, proportions, and spacing
- Command Center comprehension within ten seconds
- Mobile navigation, one-handed reach, safe areas, and browser chrome
- Today Mission and time-awareness comprehension
- Today timeline, attention queue, upcoming items, Agenda, and Week clarity
- Event overlap presentation
- Quick Add progressive disclosure and event-detail actions
- Priority and routine hierarchy
- Command/Calendar synchronization
- Loading, empty, partial, stale, offline, conflict, and error presentation
- Typography, contrast, and 200% zoom/reflow
- Touch-target comfort and keyboard focus visibility
- Desktop density at wide viewports
- Motion restraint and responsiveness
