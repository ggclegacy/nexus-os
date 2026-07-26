# Nexus OS implementation map

**Audit date:** July 26, 2026  
**Roadmap status:** Phases 0 and 1 complete; Phases 2–12 not started  
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

## 2. Phase 1 application inventory

### Routes

| Route        | State                      |
| ------------ | -------------------------- |
| `/`          | Functional Command Center  |
| `/protocol`  | Honest not-built-yet state |
| `/fitness`   | Honest not-built-yet state |
| `/sleep`     | Honest not-built-yet state |
| `/nutrition` | Honest not-built-yet state |
| `/mindset`   | Honest not-built-yet state |
| `/finance`   | Honest not-built-yet state |
| `/calendar`  | Honest not-built-yet state |
| `/atlas`     | Honest unavailable state   |
| `/vault`     | Honest not-built-yet state |
| `/life`      | Honest not-built-yet state |
| `/settings`  | Honest not-built-yet state |

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

### Shared implementation

- `components/shell`: responsive application shell and navigation
- `components/ui`: button, panel, badge, dialog, feedback, and toast primitives
- `lib/domain`: types, input validation, and briefing/alert rules
- `lib/client`: typed browser API adapter
- `lib/server`: Command composition and HTTP error boundary
- `db`: D1 repository and Drizzle schema
- `app/api`: Command, priority, timeline, and capture endpoints
- `tests`: domain, workflow, accessibility, and rendered-output checks

## 3. Data and trust boundaries

Priorities, timeline items, and quick captures are stored in a project-local D1
database under the ignored `.wrangler` directory. All API writes are parsed and
validated on the server. SQL statements use prepared bindings. The active
top-three priority rule is also enforced by the repository.

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
and minimum touch targets. Automated `jest-axe` coverage passes for the empty
Command state, and workflow tests cover keyboard access to the primary action.
Final subjective and device-specific visual inspection remains a user-owned
acceptance step.

## 5. Database schema and migration

The initial migration creates:

- `priorities` with status checks and a status/position index
- `timeline_items` with kind/status checks and a local-date/start-time index
- `quick_captures`

The repository initializes the same schema defensively in local development.
Drizzle schema changes must be followed by `npm run db:generate`.

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

Phase 1 verification on July 26, 2026 produced:

- Formatting, strict type checking, and lint: passed
- Vitest: 3 files and 11 tests passed
- Accessibility: no automated violations in the covered Command state
- Workflow coverage: priority, timeline, recovery, and keyboard paths passed
- Production build: passed
- Rendered Worker output: Command shell and honest Atlas destination passed
- Local D1 API: create/update/delete priority, create/delete timeline, and
  create quick capture passed; disposable records were removed afterward
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
| 2     | Calendar, priorities, routines, and reminders | Not started | Prepared route only             |
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
