# Nexus OS — Executable Codex Implementation Prompts

**Status:** Approved implementation roadmap  
**Companion standard:** `NEXUS_OS_CODEX_STANDARDS.md`  
**Primary repository:** `ggclegacy/nexus-os.git`  
**Intended local project:** `~/Desktop/nexus-os`  
**Brand emblem:** `icon.png`

> **Standing execution authorization:** The user authorizes Codex to execute every prompt in this document. Codex may inspect and modify the scoped files in the Nexus OS repository, install necessary project dependencies, create migrations and tests, run local development services, and run relevant automated verification. Codex should make reasonable decisions from the repository and standards, complete the full requested prompt, and avoid stopping for routine implementation approval.
>
> **Authorization boundary:** This standing permission covers the local implementation work expressly described by these prompts. It does not authorize deleting user data, overwriting unrelated user work, publishing, production deployment, purchases, sending external communications, changing external accounts, or modifying files outside the Nexus OS repository unless the active prompt explicitly directs that action.
>
> **Visual inspection ownership:** The user will perform all final visual inspections. Codex must implement the specified visual direction, perform automated and functional checks, and leave each result ready to run. Codex must not block or delay a prompt because Codex has not completed subjective visual inspection. Every implementation handoff must include exact run instructions and a short visual-review checklist for the user.

---

## 1. How to Use This Document

Execute these prompts in order unless the repository clearly shows that a phase is already complete. Each prompt is an independent authorization to perform its scoped work.

For every prompt, Codex must:

1. Read `NEXUS_OS_CODEX_STANDARDS.md` in full before editing.
2. Inspect repository instructions, the current architecture, dependencies, design system, tests, and uncommitted changes.
3. Preserve existing user work and adapt to the repository rather than replacing sound foundations.
4. Treat `icon.png` as the protected canonical emblem.
5. Use the existing stack when it is viable. Do not rewrite the app merely to match a preferred framework.
6. Make reasonable implementation decisions without asking questions that can be answered from the codebase or standards.
7. Complete the entire active prompt, including responsive behavior, interaction states, accessibility, tests, and automated verification.
8. Keep changes local unless the prompt explicitly authorizes a commit, push, deployment, or external action.
9. Never introduce purple, grain, distressed texture, old-world styling, excessive gold, fake telemetry, or decorative controls that do not work.
10. Finish with:
    - Outcome delivered
    - Important files changed
    - Data/configuration/migration notes
    - Automated checks run and their results
    - Known limitations
    - Exact local run instructions
    - A concise visual-review checklist for the user

If a check cannot run, Codex must state why and complete every other safe part of the prompt. The user, not Codex, is responsible for final visual approval.

---

## 2. Global Product and Technical Directives

These directives apply to every prompt below.

### 2.1 Product Boundary

Nexus OS is a private personal operating system. It includes:

- Home / Command Center
- Protocol
- Fitness
- Sleep and Recovery
- Nutrition and Hydration
- Mindset and Reflection
- Personal Finance
- Calendar, Priorities, Routines, and Reminders
- Atlas
- Vault
- Life
- Settings and Integrations

Do not add CRM, company projects, employees, payroll, business accounting, invoicing, marketing, company inventory, product management, customer support, or other business-operation features.

### 2.2 Visual System

- Obsidian black is dominant.
- Deep masculine green is the normal active and intelligence accent.
- Dimensional luxury gold is scarce and used for premium hierarchy or signature moments.
- Use crisp, modern, high-resolution surfaces and controlled depth.
- No purple in any token, gradient, glow, chart, state, or asset.
- No grain, patina, dirty texture, bronze haze, ornate trim, old-world detail, or gaming-style neon.
- Use `icon.png` without redesigning, distorting, recoloring, or adding text to it.
- Build mobile-first, then create deliberate tablet and desktop compositions.

### 2.3 Behavior and Quality

- Common actions acknowledge input immediately.
- Every data surface handles loading, populated, empty, refreshing, stale, offline, permission-denied, and error states where applicable.
- Do not claim saved, synced, sent, or complete without evidence.
- Keep Atlas optional; core records remain usable when AI is unavailable.
- Use semantic tokens and shared components.
- Target WCAG 2.2 AA.
- Target LCP ≤ 2.5 seconds, INP ≤ 200 ms, and CLS ≤ 0.10 at the 75th percentile for production web surfaces.
- Protect sensitive data in storage, transport, logs, analytics, URLs, notifications, and exports.
- Add tests proportionate to risk.

---

# Phase 0 — Repository Audit and Implementation Map

## Prompt 0: Audit Before Building

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform final visual inspection; this prompt is primarily structural and does not require Codex visual approval.

Read `NEXUS_OS_CODEX_STANDARDS.md` and this document completely. Inspect the Nexus OS repository without changing product behavior.

Produce a concise implementation map inside the repository at `docs/IMPLEMENTATION_MAP.md` containing:

1. Current framework, language, package manager, and runtime.
2. Existing routes, screens, modules, shared components, tokens, state management, data access, authentication, tests, and build commands.
3. Location and condition of `icon.png`.
4. Existing features that can be retained.
5. Duplicate, placeholder, fake, or conflicting implementations that should be addressed later.
6. Current mobile, accessibility, performance, privacy, and security risks.
7. Proposed domain boundaries matching the Nexus standards.
8. Proposed sequence for the remaining prompts, noting any prompt already satisfied.
9. The exact commands future prompts should use for formatting, types, lint, tests, builds, and local development.

Rules:

- Do not build or redesign the app in this phase.
- Do not delete or rewrite existing code.
- Do not install dependencies unless inspection genuinely requires an existing lockfile-compatible tool.
- Do not commit, push, or deploy.
- Separate observed facts from recommendations.
- Preserve uncommitted user changes.

Completion:

- Verify the implementation map against the actual repository.
- Report the created document and any blockers.
- Provide the user the file path; no subjective visual inspection is required.

---

# Phase 1 — Foundation and Command Center

## Prompt 1: Build the Nexus Foundation, App Shell, and Command Center v1

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval. This includes local code changes, necessary dependency installation, tests, and local build verification.  
**Visual inspection:** The user will perform all final visual inspections. Codex must provide run instructions and a visual-review checklist but must not wait for visual approval.

Read `NEXUS_OS_CODEX_STANDARDS.md`, this document, and `docs/IMPLEMENTATION_MAP.md`. Build the first complete Nexus OS vertical slice: the shared product foundation and a genuinely useful Command Center.

### Outcome

Within ten seconds of opening Nexus OS, the user should understand the day, see what needs attention, and take the next important action.

### Build

1. Establish or refine the shared design system:
   - Semantic obsidian, green, gold, text, border, status, shadow, and glow tokens
   - Typography, spacing, radii, elevation, motion, and responsive tokens
   - Buttons, icon buttons, inputs, cards/panels, badges, navigation, dialogs/sheets, skeletons, empty states, errors, and toasts
   - Accessible focus, keyboard, reduced-motion, disabled, loading, and error behavior

2. Build the responsive app shell:
   - Mobile-first navigation
   - Deliberate tablet and desktop navigation
   - Route/page header behavior
   - Global quick capture or add entry point
   - Global Atlas entry point
   - Notification/status entry point without fake counts
   - Protected, correct use of `icon.png`

3. Build Command Center v1:
   - Time-aware greeting and exact date
   - Concise daily briefing surface
   - Top three priorities with create, edit, complete, reorder, and undo where appropriate
   - Today's timeline combining user-created calendar items and routines
   - Protocol-due summary with safe status display
   - Workout and recovery summary
   - High-priority alerts/exceptions
   - Quick actions for the most likely tasks
   - Visible data freshness/source context where relevant

4. Make it functional:
   - Use the repository's real backend if already operational.
   - If no backend is ready, create a clean repository/data-service boundary and durable local development storage appropriate to the existing stack.
   - Do not hardwire sample values directly into presentation components.
   - Development seed data may be provided, but it must be clearly separated from production behavior and easy to remove.
   - Priorities and timeline items must support actual create/read/update/delete behavior.

5. Implement required states:
   - First-time empty state
   - Loading and refreshing
   - Populated
   - Partial/stale data
   - Offline/degraded behavior
   - Recoverable error
   - No Atlas availability

### Do Not Build Yet

- Full Calendar module
- Full Protocol module
- Full Fitness module
- Full Sleep module
- Live bank, wearable, medical, or calendar integrations
- Autonomous Atlas actions
- Business features

### Acceptance Criteria

- The shell and Command Center work at mobile, tablet, desktop, and wide desktop widths.
- The user can manage top priorities and basic timeline items.
- Summary cards have truthful data and clear empty states.
- The app remains useful without Atlas.
- No purple, grain, old-world treatment, excessive gold, or nonfunctional sci-fi decoration exists.
- Keyboard, focus, labels, contrast structure, reduced motion, and touch targets meet the applicable standards.
- Production build and relevant automated tests pass.
- No unauthorized commit, push, deployment, or external action occurs.

### Handoff

Include exact local run instructions and ask the user to visually inspect:

- Overall black/green/gold balance
- Gold restraint
- Absence of purple and grain
- `icon.png` sharpness and spacing
- Mobile navigation and one-handed usability
- Desktop density and hierarchy
- Command Center comprehension within ten seconds
- Motion feel and reduced-motion behavior

---

# Phase 2 — Personal Time System

## Prompt 2: Build Calendar, Priorities, Routines, and Reminders

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform all final visual inspections. Codex must complete functional and automated checks, then provide run instructions and a focused visual-review checklist.

Build the personal time system that powers the Command Center.

### Build

- Day, week, and agenda views
- Personal events with title, timing, time zone, location/notes, reminders, and recurrence
- Top priorities and flexible personal tasks
- Recurring routines with completion history
- Reminder behavior and quiet-hour awareness
- Create, edit, reschedule, complete, skip, and delete workflows
- Explicit scope handling for recurring-event edits
- Command Center integration through a stable domain interface
- Search/filter appropriate to personal events and routines
- Data provenance and sync status fields ready for future external calendars

### Standards

- Maintain one coherent internal model of time.
- Store canonical timestamps safely and present them in the user's configured time zone.
- Handle daylight-saving transitions and all-day events.
- Do not duplicate module events.
- Use undo where safe and confirmation for broad recurring changes.
- Avoid business project-management features.

### Verify

- Recurrence edge cases
- Time zones and daylight-saving transitions
- Empty, loading, offline, stale, and conflict states
- Mobile agenda usability
- Keyboard operation
- Command Center updates after changes
- Relevant automated tests and production build

Handoff with run instructions and a user visual-review checklist. Do not commit, push, or deploy unless separately instructed.

---

# Phase 3 — Protocol

## Prompt 3: Build the Personal Protocol Module

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform final visual inspection. Codex must focus on correctness, safety, accessibility, automated checks, and review readiness.

Build the personal Protocol module and connect today's safe, concise status to the Command Center.

### Build

- Medications, supplements, and other explicitly user-managed protocol items
- Name, form, dose, unit, schedule, start/end dates, instructions, prescriber/source, and personal notes
- Clear distinction between clinician instruction, user entry, imported data, and Atlas suggestion
- Today's due, taken, skipped, late, and missed states
- Adherence history and calendar
- Refill and personal inventory reminders
- Bloodwork/biomarker record structure with units, ranges, source, collection date, and document link
- Safety-conscious edit history
- Export-ready data structures
- Command Center protocol summary

### Safety Rules

- Never infer or silently change a dose, unit, frequency, or medical instruction.
- Require explicit confirmation for consequential changes.
- Do not diagnose, prescribe, or represent Atlas content as clinician guidance.
- Make missing units or ambiguous schedules impossible to save as valid records.
- Protect protocol data as highly sensitive.

### Verify

- Unit and schedule validation
- Time-zone behavior
- Duplicate-entry prevention or warning
- Edit/audit behavior
- Sensitive-data logging review
- Empty, loading, offline, stale, and error states
- Keyboard, screen-reader, touch-target, and reduced-motion behavior
- Automated tests and production build

Handoff with run instructions and a concise user visual-review checklist. No unauthorized external medical integration, commit, push, or deployment.

---

# Phase 4 — Fitness

## Prompt 4: Build Fitness and the Active Workout Experience

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform all final visual inspections. Codex must provide a fully runnable implementation and a workout-specific review checklist.

Build the Fitness module with a fast, interruption-safe active workout flow.

### Build

- Exercise library with categories, equipment, instructions, and configurable units
- Workout templates and plans
- Active workout with sets, reps, load, distance, duration, rest timer, notes, and exercise substitution
- Fast logging with large touch targets and minimal taps
- Pause, resume, recover interrupted session, finish, and discard behavior
- Workout history, exercise history, volume, consistency, and personal records
- Cardio and conditioning entries
- Mobility/recovery session support
- Command Center workout summary and next action

### Standards

- Active session state must survive ordinary navigation, refresh, and temporary disconnection where feasible.
- Never lose completed sets silently.
- Make units explicit and configurable.
- Distinguish estimated records from verified performance.
- Avoid social feeds, competition gimmicks, and shame-based streaks.

### Verify

- Long and interrupted sessions
- Duplicate submissions
- Timer background behavior where the platform permits
- Unit conversions
- History edits and PR recalculation
- Large realistic datasets
- Mobile one-handed use, keyboard use, accessibility, and automated tests
- Production build and performance

Handoff with run instructions and a focused user visual-review checklist. Do not commit, push, or deploy unless separately instructed.

---

# Phase 5 — Sleep and Recovery

## Prompt 5: Build Sleep and Recovery

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform final visual inspection. Codex must complete data, functional, accessibility, and automated verification and provide review instructions.

Build the Sleep and Recovery module with honest source and uncertainty handling.

### Build

- Manual sleep entry and editing
- Sleep window, duration, consistency, interruptions, and subjective quality
- Recovery signals such as resting heart rate, HRV, respiratory rate, soreness, and energy when data exists
- Source, last sync, timezone, and estimated/imported/user-entered labels
- Bedtime and wake routines
- Trends and carefully framed correlations
- Command Center sleep/recovery summary
- Integration adapter boundary ready for future wearables without coupling the module to one vendor

### Standards

- Missing data must never appear as zero.
- Device-derived values must be labeled as estimates or source-reported metrics.
- Do not imply diagnosis or causation.
- Recommendations must mention stale, incomplete, or conflicting data when relevant.
- Charts must work with touch, keyboard, and assistive technology.

### Verify

- Overnight records spanning dates and time zones
- Daylight-saving changes
- Missing and conflicting data
- Source freshness
- Chart accessibility and readable summaries
- Mobile and desktop functional behavior
- Automated tests, production build, and performance

Handoff with run instructions and a short user visual-review checklist. Do not add a live wearable integration unless separately requested.

---

# Phase 6 — Atlas

## Prompt 6: Build Atlas as the Personal Intelligence Layer

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval, including local AI-service wiring when credentials and approved providers already exist.  
**Visual inspection:** The user will perform final visual inspection. Codex must make Atlas runnable, safe, testable, and ready for the user's review.

Build Atlas as an optional concierge across the modules already implemented.

### Build

- Atlas conversation surface with concise default responses
- Daily briefing generated from authorized personal-domain interfaces
- Cross-module questions with source dates and freshness
- Clear separation of fact, inference, and recommendation
- Draft actions such as creating a routine, priority, or workout plan
- Preview and explicit confirmation before any write
- Permission-aware retrieval
- Conversation and tool-action history appropriate to the privacy model
- Graceful provider failure, timeout, missing credential, and offline behavior
- Direct non-AI workflows that remain fully usable

### Safety and Privacy

- Never fabricate records or completed actions.
- Never expose records outside current authorization.
- Do not place full sensitive records into logs, analytics, or error reports.
- Do not use personal data for training without explicit informed opt-in.
- Require confirmation for consequential changes.
- Medical and financial responses must state uncertainty and professional boundaries.
- Show exactly what a multi-record action will change.

### Architecture

- Keep provider-specific code behind an adapter.
- Use structured, validated tool inputs and outputs.
- Apply least-privilege tool access.
- Defend against untrusted content attempting to alter Atlas instructions or permissions.
- Add deterministic tests for tool routing, permissions, confirmation, and failure behavior.

### Verify

- No-AI and failed-AI states
- Hallucination-resistant handling of missing personal data
- Permission boundaries
- Confirmation and cancellation
- Prompt-injection boundaries for imported content
- Mobile conversation behavior and keyboard accessibility
- Automated tests and production build

Handoff with run instructions, required local configuration, and a user visual-review checklist. Do not send external messages, make purchases, alter financial accounts, or deploy.

---

# Phase 7 — Nutrition and Hydration

## Prompt 7: Build Nutrition, Hydration, Weight, and Measurements

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform final visual inspection. Codex must complete the implementation and automated checks, then provide run and review guidance.

Build flexible nutrition tracking that works for both light and detailed use.

### Build

- Rapid meal and food entry
- Reusable foods, meals, and recent items
- Optional calories and macros
- Hydration entry and daily status
- Weight and body measurements
- Configurable goals and units
- User-entered versus estimated/imported labeling
- Trends without shame-based language
- Command Center nutrition/hydration status

### Standards

- Detailed tracking must be optional.
- Common entries should be fast to repeat.
- Units and serving assumptions must be visible.
- Never present estimated nutrition as exact.
- Protect body measurements and progress media as sensitive data.

### Verify

- Unit conversion and rounding
- Editing/deleting historical entries
- Incomplete nutrition information
- Large history performance
- Mobile rapid entry
- Accessibility, automated tests, and production build

Handoff with run instructions and a concise user visual-review checklist. No external food database integration unless separately requested.

---

# Phase 8 — Personal Finance

## Prompt 8: Build Personal Finance

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval. This does not authorize live money movement or external account changes.  
**Visual inspection:** The user will perform final visual inspection. Codex must prioritize calculation correctness, privacy, accessibility, and automated verification.

Build personal finance only—never business accounting.

### Build

- Personal accounts and balances
- Manual transactions and categories
- Bills and subscriptions
- Budget and personal cash flow
- Assets, liabilities, and net worth
- Savings and debt goals
- Currency and period handling
- Privacy mask for sensitive values
- Transparent calculation details
- Command Center alerts for personal bills or exceptions
- Integration adapter boundary ready for future financial providers

### Rules

- Exclude payroll, invoicing, customers, vendors, company books, and financial statements for businesses.
- Never imply a live balance without source and freshness.
- Make calculations reproducible.
- Avoid logging sensitive financial values.
- Do not initiate transfers, trades, payments, or account changes.
- Atlas may explain scenarios but must not promise outcomes.

### Verify

- Currency precision and rounding
- Date and reporting-period boundaries
- Net-worth and cash-flow calculations
- Missing, stale, and duplicate data
- Privacy masking
- Export correctness
- Authorization and sensitive-data logging review
- Accessibility, automated tests, and production build

Handoff with run instructions and a user visual-review checklist. Do not connect a live bank unless separately authorized.

---

# Phase 9 — Mindset and Life

## Prompt 9: Build Mindset, Reflection, Goals, Habits, and Learning

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform final visual inspection. Codex must complete functional, privacy, accessibility, and automated checks and provide review guidance.

Build two coherent personal experiences using shared foundations: private reflection and purposeful personal progress.

### Mindset

- Private journal
- Daily reflection
- Gratitude
- Mood and energy check-ins
- Personal vision and values
- Optional concise prompts
- Search and history with privacy-aware indexing

### Life

- Personal goals and milestones
- Habits and completion history
- Reading and learning
- Personal checklists and bucket list
- Home/vehicle/personal maintenance reminders where appropriate
- Personal projects only; no company project management

### Standards

- Entries are private by default.
- Avoid sentimental filler, public-social behavior, guilt, and manipulative streaks.
- Life must not become a dumping ground.
- Mental-health language must not imply diagnosis.
- Provide safety-appropriate behavior for crisis-related content instead of ordinary productivity coaching.

### Verify

- Search permissions and indexing privacy
- Long entries and large histories
- Goal and habit recurrence
- Data export/deletion
- Empty states and gentle interruption behavior
- Accessibility, automated tests, and production build

Handoff with run instructions and a focused user visual-review checklist. Do not create business projects or social sharing without separate authorization.

---

# Phase 10 — Vault

## Prompt 10: Build the Secure Personal Vault

**Execution authorization:** The user authorizes Codex to execute this prompt without pausing for routine approval, but not to weaken security controls or upload real private documents to unapproved services.  
**Visual inspection:** The user will perform final visual inspection. Codex must complete security-focused functional and automated verification and provide review guidance.

Build the Vault for important personal records.

### Build

- Record categories for identity, insurance, medical, legal/estate, warranties/receipts, emergency information, and secure notes
- Secure metadata and document attachment workflows
- Search with permission-aware indexing
- Preview, download, export, share preparation, and deletion workflows
- Sensitive preview masking
- Audit history for consequential actions
- Expiration and renewal reminders
- Storage adapter boundary appropriate to the existing architecture

### Security Rules

- Do not invent a homemade password manager.
- Do not support raw passwords or recovery codes without a separately approved, purpose-built security design.
- Encrypt sensitive data appropriately in transit and at rest.
- Never place Vault contents or identifiers in URLs, logs, analytics, or push text.
- Require explicit confirmation for sharing and deletion.
- Enforce authorization at the trusted data boundary.
- Use safe test fixtures, never real personal documents.

### Verify

- File type and size validation
- Malicious filename/content handling appropriate to the stack
- Authorization and record ownership
- Masking and recent-auth behavior where applicable
- Export and deletion
- Audit records
- Accessibility, automated security tests, and production build

Handoff with run instructions, storage/configuration notes, and a user visual-review checklist. Do not upload real user documents or enable external sharing without separate authorization.

---

# Phase 11 — Settings, Integrations, and User Control

## Prompt 11: Build Settings, Privacy, Security, and Integration Control

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval.  
**Visual inspection:** The user will perform final visual inspection. Codex must complete the controls, automated checks, and review handoff.

Build a clear control center for the Nexus OS installation.

### Build

- Profile and personal preferences
- Units, locale, currency, and time zone
- Notifications, categories, and quiet hours
- Accessibility preferences
- Session/device review where supported
- Atlas permissions and data-access controls
- Privacy explanations and consent controls
- Data export and account/data deletion preparation
- Integration list with permissions, scope, last sync, health, and disconnect behavior
- Appearance settings only within the locked Nexus visual identity

### Standards

- Do not offer purple or unapproved themes.
- Privacy, export, and deletion must be easy to find.
- Explain the consequences of disconnecting an integration.
- Do not claim a security capability the stack does not provide.
- Avoid exposing technical configuration to ordinary users when a clear explanation is possible.

### Verify

- Settings persistence
- Permission changes propagating to Atlas and modules
- Notification quiet hours
- Locale, unit, currency, and timezone propagation
- Export/delete preparation
- Integration failure and disconnect states
- Accessibility, automated tests, and production build

Handoff with run instructions and a user visual-review checklist. Do not disconnect real services, delete data, or change external accounts during testing.

---

# Phase 12 — System Hardening

## Prompt 12: Complete Accessibility, Performance, Reliability, Privacy, and Security Hardening

**Execution authorization:** The user authorizes Codex to execute this entire prompt without pausing for routine approval, including scoped refactoring necessary to meet the standards.  
**Visual inspection:** The user will perform final visual inspection. Codex must provide objective results, a runnable build, and a final visual-review checklist.

Audit the full Nexus OS implementation against `NEXUS_OS_CODEX_STANDARDS.md`. Fix verified issues within the existing product scope.

### Accessibility

- WCAG 2.2 AA review
- Keyboard-only operation
- Focus order and focus visibility
- Dialog/sheet focus management
- Accessible names, roles, states, errors, and live messages
- Chart summaries or equivalent data access
- 200% zoom/reflow
- Reduced motion
- Touch-target sizing

### Performance

- Measure production behavior using realistic data and a mid-tier mobile profile
- Address critical rendering, payload, request waterfalls, rerenders, image sizing, font loading, long lists, and expensive effects
- Target LCP ≤ 2.5 seconds, INP ≤ 200 ms, and CLS ≤ 0.10 at the 75th percentile
- Document remaining exceptions with evidence

### Reliability

- Exercise loading, empty, refreshing, stale, offline, denied, and error states
- Isolate module and integration failures
- Protect in-progress user input
- Prevent duplicate submissions
- Verify backup/migration/recovery behavior available in the current architecture

### Privacy and Security

- Review authentication, authorization, sessions, secret handling, storage, logs, analytics, URLs, exports, uploads, and dependency risks
- Remove sensitive-data exposure
- Validate all trust boundaries
- Verify Atlas least privilege and confirmation gates
- Do not perform destructive security testing against production or real user data

### Quality

- Run format, type, lint, unit, component, integration, end-to-end, accessibility, and production-build checks supported by the repository
- Resolve flaky tests within scope
- Remove obsolete placeholders, dead flags, and fake controls encountered in the implemented modules
- Do not expand into business features or unrelated rewrites

### Deliver

- Update `docs/IMPLEMENTATION_MAP.md` to reflect the finished architecture and commands.
- Create `docs/RELEASE_READINESS.md` with objective results, known limitations, configuration requirements, migration notes, and remaining risks.
- Provide exact run instructions.
- Provide one final user visual-review checklist covering palette, emblem, hierarchy, density, motion, responsive behavior, and module consistency.
- Do not commit, push, deploy, publish, or modify production data unless separately instructed.

---

# Optional Future Prompts

These are intentionally not part of the core build. Execute them only when the user specifically selects one.

## Prompt A: Add a Specific External Integration

**Execution authorization:** When the user selects and names this prompt plus the target service, Codex is authorized to implement the scoped local integration without pausing for routine approval. External account changes still require the provider's normal authorization flow.  
**Visual inspection:** The user will perform final visual inspection.

Implement one named integration behind an adapter. Define exact read/write scope, consent, permissions, data mapping, source provenance, freshness, deduplication, conflict handling, rate limits, revoked access, disconnect behavior, privacy, and tests. Do not broaden access beyond what the selected feature needs.

## Prompt B: Prepare a Release Candidate

**Execution authorization:** When the user explicitly selects this prompt, Codex is authorized to prepare the local release candidate and complete local verification. This is not permission to deploy or publish.  
**Visual inspection:** The user will perform final visual inspection and approval.

Create a release candidate from the current local project. Run the full supported verification suite, confirm configuration and migrations, generate release notes, and provide launch/rollback instructions. Do not publish, deploy, push, or alter production data unless separately instructed.

---

## Final Instruction to Codex

These prompts authorize implementation; they are not invitations to produce another plan instead of doing the work.

When the user asks Codex to execute a numbered prompt:

1. Start by reading the standards and current repository state.
2. Implement the prompt completely.
3. Make safe, reasonable decisions autonomously.
4. Run objective automated and functional verification.
5. Leave the feature ready for the user's visual inspection.
6. Provide exact run instructions and a concise visual-review checklist.
7. Stop only for a genuine blocker, a required external credential/choice, or an action outside the authorization boundary.

The user owns final visual inspection. Codex is authorized to execute every scoped implementation prompt in this document.
