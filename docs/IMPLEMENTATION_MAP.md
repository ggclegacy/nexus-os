# Nexus OS implementation map

**Audit date:** July 26, 2026

**Roadmap status:** Phases 0–2, Command/Personal Time final hardening, and
Calendar Phases 1–2 complete; later domain modules not started

**Scope:** Local workspace `/Users/neil/Desktop/nexus-os`

This map records the implementation that exists in the local Git workspace. It
does not claim that the remote repository or a deployed environment has this
uncommitted hardening state.

## 1. Technical baseline

- **Application:** Vinext `0.0.50` with the Next.js App Router
- **Language:** TypeScript in strict mode
- **Runtime:** Node.js 22.13 or newer and Cloudflare Workers-compatible APIs
- **UI:** React and React DOM `19.2.8`, Lucide icons, semantic CSS
- **Persistence:** Cloudflare D1 for Vinext; Turso/libSQL (or ignored
  `local.db`) for the Vercel-compatible Next runtime
- **Schema:** Drizzle ORM definitions and a checked-in SQL migration
- **Package manager:** npm with `package-lock.json`
- **Version control:** Git repository with
  `github.com/ggclegacy/nexus-os.git` as `origin`
- **Hosting configuration:** `.openai/hosting.json` declares the D1 binding; no
  deployment was performed
- **Private access:** localhost bypass for development; all non-local routes
  fail closed behind a configured single-owner access gate

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

- Today-first Calendar landing surface plus Agenda, Week, stable six-week
  Month, Reminder Center, Birthday Planning, Bill Planning, Priorities, and
  Routines workspaces with URL-backed view and date state
- A maximum-five-item Today Mission, live time awareness, current/next/later
  timeline treatment, unresolved-past attention queue, and upcoming
  bill/medical/birthday look-ahead
- Eleven centralized event types: Personal, Medical, Financial, Meeting,
  Workout, Protocol, Family, Birthday, Travel, Reminder, and Custom
- Type-aware defaults for all-day behavior, yearly birthdays, financial,
  medical, meeting, workout, and protocol reminders
- Timed, all-day, multi-day, and recurring personal events with daily, weekly,
  monthly date/relative/last-day, and yearly leap-day-safe rules; interval,
  until, and occurrence-count endings; and explicit this/future/series edit
  scope
- Time-zone-aware conversion, daylight-saving gap rejection, fixed all-day
  dates, overlap review, scheduled/completed/dismissed/cancelled state,
  priority, provider, meeting link, amount/currency/payment state, location,
  notes, and up to five in-app reminders
- Event detail, edit, reschedule, recurring-scope, safe-delete, complete,
  dismiss, restore, mark-paid, and mark-unpaid workflows with reload
  persistence
- Expanded priority workspace with top-three enforcement, regular active
  priorities, ordering, completion/restore, due rollover, notes, focus blocks,
  reminder offsets, delete, and undo
- Routine definitions and occurrence history with active/paused/archived
  states, flexible or preferred time, windows, duration, reminder settings,
  complete/skip/restore, and occurrence notes
- Configurable time zone, week start, 12/24-hour clock, overnight quiet hours,
  quiet behavior, default view/duration/snooze, brief times, transition and
  overload thresholds, bounded escalation, and truthful permission/provider
  states
- Debounced search with type/status/importance/payment/recurrence filters and
  Birthday, Bills, Medical, Unresolved, and Recurring presets
- Persistent reminder instances with scheduled, delivered, seen, snoozed,
  resolved, dismissed, and expired lifecycle states; duplicate-safe
  reconciliation; quiet-hours behavior; custom snooze; bounded escalation; and
  a resolution history
- Birthday metadata and horizon planning, financial category/autopay/account
  notes and due/paid planning, conflict/tight-transition/overload signals,
  deterministic Morning/Evening Briefs, and confirm-before-apply Rescue Mode
  with undo
- Responsive week/month reflow and mobile stacking without horizontal page
  overflow

### Shared implementation

- `components/shell`: responsive application shell and navigation
- `components/ui`: button, panel, badge, dialog, feedback, and toast primitives
- `lib/domain` and `lib/time`: types, validation, recurrence, time-zone,
  reminder, routine-state, briefing, and alert rules
- `lib/client`: typed Command and personal-time API adapters
- `lib/server`: Command composition and HTTP error boundary
- `lib/server/access.ts` and `proxy.ts`: hosted private-access and cross-site
  write boundary
- `db`: runtime-neutral Command/time repositories, D1/libSQL adapters, and
  Drizzle schema
- `app/api`: Command, event, priority, routine, occurrence, preference,
  timeline, and capture endpoints
- `tests`: domain, workflow, accessibility, and rendered-output checks

## 3. Data and trust boundaries

Priorities, canonical timeline events, typed event metadata, recurrence
exceptions, routines, occurrence history, reminder rules, persistent reminder
instances, preferences, and quick captures share the same SQLite model. Local
Vinext uses project-local D1 under
ignored `.wrangler`; Vercel uses Turso/libSQL and can use ignored `local.db` for
local testing. All API writes are bounded and validated on the server. SQL uses
prepared bindings. Top-three mutations are atomic, recurring edit scope is
explicit, reminder replacement is batched, and routine occurrences are
unique-key upserts.

Legacy Phase 1 routine rows are migrated idempotently into routine definitions
and occurrence history. Their source rows remain as inactive recovery evidence,
marked with the destination routine ID. Phase 2 extends canonical priorities and
timeline events in place rather than creating competing data sources.

Command surfaces are composed independently. A failed source can return an
explicit partial state without fabricating values for the remaining surfaces.
POST clients retry an interrupted request once with the same idempotency key.
Offline state is explicit and recoverable form input is retained, but there is
no offline mutation queue or full-reload draft persistence. Reminders are
deterministic in-app records only; there is no background/push provider.

Non-local requests require environment-configured single-owner credentials at
the application proxy before API or page access. Cross-site mutations are
rejected and security headers are added. This is suitable for the one-owner
release, not multi-user identity, per-record sharing, or delegated access. No
external integrations, telemetry, Atlas provider, health/financial record, or
Vault content is connected.

## 4. Design and accessibility

`app/globals.css` defines centralized color, typography, spacing, radius,
shadow, motion, focus, status, layout, and navigation tokens. The visual system
uses the approved obsidian, green, and restrained gold direction; no purple
accent system or added grain texture is implemented.

The UI uses semantic landmarks, headings, labels, live regions, focus
management, visible focus styling, reduced-motion handling, reflow breakpoints,
and minimum touch targets. Automated `jest-axe` coverage passes for empty and
populated Command/Calendar states plus the edit dialog. Workflow tests cover
keyboard access and core personal-time mutation paths.
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

The additive Calendar Phase 1 migration:

- adds one `event_metadata` JSON-text column to canonical `timeline_items`
- preserves every existing event row and all prior columns
- carries event type, provider, meeting URL, amount, currency, payment state,
  priority, and the expanded event status without creating a competing event
  store

The additive Calendar Phase 2 migration:

- creates `reminder_instances` with a unique reminder-rule/occurrence key and
  indexed lifecycle schedule
- extends `time_preferences` with default view/duration/snooze, brief times,
  transition and overload thresholds, and bounded escalation controls
- contains no drop, delete, or canonical event/reminder rewrite

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

Latest Calendar Phase 2 verification on July 26, 2026 produced:

- Formatting, strict type checking, and lint: passed
- Vitest: 12 files and 62 tests passed
- Accessibility: 5 axe checks passed with no automated violations in empty and
  populated Command/Calendar states, the priority edit dialog, and the Month
  grid
- End-to-end component coverage: 2 files and 15 workflows passed, including
  timed/all-day/recurring events, explicit occurrence/future/series scope,
  type defaults, multiple reminders, bill payment, reload persistence,
  top-three priority behavior, routine occurrence history, overlap
  acknowledgement, offline state, and recovery
- Time tests: DST gap/fall-back, cross-zone date display, all-day stability,
  overnight events and quiet hours, month/year/leap boundaries, relative
  monthly recurrence, occurrence counts, and bounded dense expansion passed
- Calendar Phase 2 coverage: 42-cell Month grid, advanced recurrence and
  leap-day fallback, planning buckets/totals, warnings, briefs, rescue
  candidates, snooze behavior, planner navigation, bill resolution, and
  Reminder Center dismissal passed
- Persistent reminder lifecycle: disposable libSQL reconciliation, duplicate
  prevention, snooze persistence, and resolution persistence passed
- Migration safety tests: additive Phase 2, Calendar metadata, and persistent
  reminder migrations plus canonical-table preservation passed
- Vinext/Worker and Vercel/Next production builds: passed
- Rendered Worker and Vercel output: Command, Calendar, and honest unbuilt
  destination passed
- Disposable Vercel-compatible libSQL API: typed financial event creation,
  four-reminder persistence, reload, payment/completion update, and second
  reload passed without touching a repository-local user store
- Warm local Next production responses: Command page 20.8 ms, Calendar page
  10.3 ms, Calendar API 16.9 ms, and Command API 9.8 ms
- Client assets: Calendar 79,581 bytes raw, Command 26,026 bytes, shared shell
  54,428 bytes, and CSS 61,264 bytes
- Protected emblem SHA-256 remained
  `e77502c093ca5d7b8994aa13fee310ef8e8a5cab4c4b6a3f33dbdec5d1a9ae4c`;
  prohibited-color/texture term scan returned no implementation matches
- Production dependency audit: zero known vulnerabilities
- Hosted access runtime: 401 without credentials, 200 with credentials, 403
  for a cross-site mutation; idempotency, top-three conflicts, in-place undo,
  and occurrence upsert checks passed against a disposable synthetic database

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

The separate Command Center Phase 3 final-hardening pass is complete for the
Phase 1–2 vertical slice. It does not mark the Protocol domain module or the
later system-wide hardening roadmap item complete. Extension points remain the
typed repository contracts, shared Command composition, API adapters, and
prepared honest routes for later modules.

No commit, push, pull request, deployment, publication, or external account
action was performed.
