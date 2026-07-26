# Nexus OS implementation map

**Audit date:** July 26, 2026

**Roadmap status:** Phases 0–2 complete; Phases 3–12 not started

**Scope:** Local workspace `/Users/neil/Desktop/nexus-os`

This map records the implementation that exists in the local workspace. It does
not claim that a remote repository or deployed environment has the same state.

## 1. Technical baseline

- **Application:** Vinext `0.0.50` with the Next.js App Router
- **Language:** TypeScript in strict mode
- **Runtime:** Node.js 22.13 or newer and Cloudflare Workers-compatible APIs
- **UI:** React and React DOM `19.2.8`, Lucide icons, semantic CSS
- **Persistence:** Local Cloudflare D1 binding `DB`
- **Schema:** Drizzle ORM definitions and a checked-in SQL migration
- **Package manager:** npm with `package-lock.json`
- **Version control:** This local directory is not a Git working tree
- **Hosting configuration:** `.openai/hosting.json` declares the D1 binding; no
  deployment was performed

The protected `icon.png` remains byte-for-byte unchanged. Its SHA-256 is
`e77502c093ca5d7b8994aa13fee310ef8e8a5cab4c4b6a3f33dbdec5d1a9ae4c`.
Optimized 96 px and 192 px derivatives are served from `public/`.

## 2. Phase 1–2 application inventory

### Routes

| Route        | State                           |
| ------------ | ------------------------------- |
| `/`          | Functional Command Center       |
| `/protocol`  | Honest not-built-yet state      |
| `/fitness`   | Honest not-built-yet state      |
| `/sleep`     | Honest not-built-yet state      |
| `/nutrition` | Honest not-built-yet state      |
| `/mindset`   | Honest not-built-yet state      |
| `/finance`   | Honest not-built-yet state      |
| `/calendar`  | Functional personal time system |
| `/atlas`     | Honest unavailable state        |
| `/vault`     | Honest not-built-yet state      |
| `/life`      | Honest not-built-yet state      |
| `/settings`  | Honest not-built-yet state      |

The responsive shell provides desktop sidebar, tablet header/drawer, and mobile
bottom navigation patterns. It includes the full module map, private-local
status, Atlas entry, settings entry, skip navigation, and Quick Add.

### Command Center

- Exact local date, time-aware greeting, private workspace status, and refresh
- Deterministic briefing that remains useful when Atlas is unavailable
- Top-three priorities with create, edit, complete, restore, reorder, delete,
  and undo behavior
- Timeline events, all-day items, and routines with create, edit, complete,
  skip, restore, delete, and undo behavior
- Honest empty states for Protocol and workout/recovery data
- Alerts derived only from actual priority and timeline conditions
- Quick Capture persisted to the local database
- Loading, refreshing, empty, partial, stale, offline, recoverable error, toast,
  dialog validation, and focus states
- Calendar-backed events and routines plus the same canonical top-three
  priorities, with recurring changes routed to Calendar for explicit scope

### Personal time

- Agenda, Day, Week, Priorities, and Routines workspaces with URL-backed view
  and date state
- Timed, all-day, multi-day, and recurring personal events with daily, weekly,
  monthly date/relative, and yearly rules; interval, until, and occurrence-count
  endings; and explicit this/future/series edit scope
- Time-zone-aware conversion, daylight-saving gap rejection, fixed all-day
  dates, overlap review, event status, location, notes, category, and in-app
  reminder configuration
- Expanded priority workspace with top-three enforcement, regular active
  priorities, ordering, completion/restore, due rollover, notes, focus blocks,
  reminder offsets, delete, and undo
- Routine definitions and occurrence history with active/paused/archived
  states, flexible or preferred time, windows, duration, reminder settings,
  complete/skip/restore, and occurrence notes
- Configurable time zone, week start, 12/24-hour clock, overnight quiet hours,
  quiet behavior, and truthful permission/provider states
- Responsive week reflow and mobile stacking without horizontal page overflow

### Shared implementation

- `components/shell`: responsive application shell and navigation
- `components/ui`: button, panel, badge, dialog, feedback, and toast primitives
- `lib/domain` and `lib/time`: types, validation, recurrence, time-zone,
  reminder, routine-state, briefing, and alert rules
- `lib/client`: typed Command and personal-time API adapters
- `lib/server`: Command composition and HTTP error boundary
- `db`: shared Command/time D1 repositories and Drizzle schema
- `app/api`: Command, event, priority, routine, occurrence, preference,
  timeline, and capture endpoints
- `tests`: domain, workflow, accessibility, and rendered-output checks

## 3. Data and trust boundaries

Priorities, canonical timeline events, recurrence exceptions, routines,
occurrence history, reminders, preferences, and quick captures are stored in a
project-local D1 database under the ignored `.wrangler` directory. All API
writes are parsed and validated on the server. SQL statements use prepared
bindings. The active top-three rule and explicit recurring edit scope are also
enforced by the repository.

Legacy Phase 1 routine rows are migrated idempotently into routine definitions
and occurrence history. Their source rows remain as inactive recovery evidence,
marked with the destination routine ID. Phase 2 extends canonical priorities and
timeline events in place rather than creating competing data sources.

Command surfaces are composed independently. A failed source can return an
explicit partial state without fabricating values for the remaining surfaces.
No external integrations, cloud sync, telemetry, Atlas provider, health record,
financial record, or Vault content is connected.

This is a private local-development boundary, not production authentication or
authorization. Before storing genuinely sensitive data or deploying the app, a
later phase must add identity, authorization, session controls, audit behavior,
secure secret management, export, and deletion policy.

## 4. Design and accessibility

`app/globals.css` defines centralized color, typography, spacing, radius,
shadow, motion, focus, status, layout, and navigation tokens. The visual system
uses the approved obsidian, green, and restrained gold direction; no purple
accent system or added grain texture is implemented.

The UI uses semantic landmarks, headings, labels, live regions, focus
management, visible focus styling, reduced-motion handling, reflow breakpoints,
and minimum touch targets. Automated `jest-axe` coverage passes for empty
Command and Calendar states, and workflow tests cover keyboard access and core
personal-time mutation paths.
Final subjective and device-specific visual inspection remains a user-owned
acceptance step.

## 5. Database schema and migration

The initial migration creates:

- `priorities` with status checks and a status/position index
- `timeline_items` with kind/status checks and a local-date/start-time index
- `quick_captures`

The additive Phase 2 migration:

- extends `priorities` with notes, top-three membership, focus time, archive,
  and reminder fields
- extends canonical `timeline_items` with event details, recurrence,
  source/version/sync placeholders, conflict state, and soft deletion
- creates `event_exceptions`, `routines`, `routine_occurrences`, `reminders`,
  and `time_preferences`
- does not drop or replace Phase 1 priority or timeline tables

The repository initializes the same schema defensively in local development.
Drizzle schema changes must be followed by `npm run db:generate`.

Recovery is additive: a database backup can restore the complete Phase 1 state,
and legacy routine timeline rows are retained with `migrated_to_routine_id`
rather than erased. Rolling application code back to Phase 1 leaves its
original columns and rows readable; Phase 1 simply ignores the added columns
and tables. The generated migration intentionally contains no `DROP TABLE` or
data deletion for canonical Phase 1 stores.

## 6. Verification contract

Run from the repository root:

```sh
npm ci
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run test:accessibility
npm run test:e2e
npm run build
npm run test:rendered
npm audit --omit=dev
npm run dev
```

Phase 2 verification on July 26, 2026 produced:

- Formatting, strict type checking, and lint: passed
- Vitest: 6 files and 30 tests passed
- Accessibility: no automated violations in covered empty Command and Calendar
  states
- End-to-end component coverage: 2 files and 12 workflows passed, including
  timed/all-day/recurring events, explicit occurrence/future/series scope,
  top-three priority behavior, routine occurrence history, reminder settings,
  overlap acknowledgement, offline state, and recovery
- Time tests: DST gap/fall-back, cross-zone date display, all-day stability,
  overnight events and quiet hours, month/year/leap boundaries, relative
  monthly recurrence, occurrence counts, and bounded dense expansion passed
- Migration safety tests: additive Phase 2 schema and Phase 1 canonical-table
  preservation passed; `db:generate` reports no ungenerated schema changes
- Production build: passed
- Rendered Worker output: Command, Calendar, and honest Atlas destination passed
- Local D1 API: recurring event, focused priority, routine, reminders,
  occurrence completion/note, Command synchronization, and safe delete/archive
  paths passed; exact cleanup returned zero disposable records
- Warm local responses: Command page 214 ms, Calendar page 365 ms, Calendar API
  87 ms, and Command API 70 ms in the development server
- Calendar client chunk: 59 KB raw and approximately 14.9 KB gzip
- Protected emblem SHA-256 remained
  `e77502c093ca5d7b8994aa13fee310ef8e8a5cab4c4b6a3f33dbdec5d1a9ae4c`;
  prohibited-color/texture term scan returned no implementation matches
- Production dependency audit: zero known vulnerabilities

The full development dependency audit still reports the upstream
`brace-expansion` advisory through ESLint's `minimatch@3` toolchain. The patched
major is API-incompatible with that toolchain, so it is not force-overridden.
This affects local lint tooling rather than the production dependency graph.

## 7. Roadmap status

| Order | Prompt                                        | Status      | Note                            |
| ----- | --------------------------------------------- | ----------- | ------------------------------- |
| 0     | Repository audit and implementation map       | Complete    | Baseline recorded               |
| 1     | Foundation, app shell, and Command Center v1  | Complete    | Functional local vertical slice |
| 2     | Calendar, priorities, routines, and reminders | Complete    | Functional local vertical slice |
| 3     | Protocol                                      | Not started | Prepared route only             |
| 4     | Fitness                                       | Not started | Prepared route only             |
| 5     | Sleep and Recovery                            | Not started | Prepared route only             |
| 6     | Atlas                                         | Not started | Explicitly unavailable          |
| 7     | Nutrition and Hydration                       | Not started | Prepared route only             |
| 8     | Personal Finance                              | Not started | Prepared route only             |
| 9     | Mindset and Life                              | Not started | Prepared routes only            |
| 10    | Vault                                         | Not started | Prepared route only             |
| 11    | Settings and Integrations                     | Not started | Prepared route only             |
| 12    | System hardening                              | Not started | Follows the core modules        |

No commit, push, pull request, deployment, publication, or external account
action was performed.
