# Nexus OS — Codex Product, Design, Engineering, and Build Standards

**Status:** Canonical project standard  
**Applies to:** Every future Nexus OS design, build, refactor, integration, content, and review prompt  
**Product type:** Private personal operating system  
**Primary repository:** `ggclegacy/nexus-os.git`  
**Intended project location:** `~/Desktop/nexus-os`  
**Brand emblem source:** `icon.png`

---

## 1. Purpose of This Document

This document is the permanent source of truth for what Nexus OS is, what belongs in it, how it must look and behave, and the quality bar every future Codex task must meet.

It is a standards document, not an instruction to build the app. It does not select or replace a technical stack, create features, or authorize broad changes. Future implementation prompts must use it to keep the product coherent as it grows.

When a future prompt conflicts with this document, Codex must:

1. Identify the conflict before implementation.
2. Follow this document unless the user explicitly overrides the conflicting rule.
3. Treat an override as narrow to that prompt unless the user explicitly asks to update this standards document.
4. Never silently weaken the product boundary, visual identity, privacy model, accessibility, or performance standards.

The words **must**, **must not**, **should**, and **may** are intentional:

- **Must / must not:** Required for acceptance.
- **Should / should not:** Strong default; deviations require a stated reason.
- **May:** Optional and dependent on the feature.

---

## 2. Product Definition

### 2.1 North Star

Nexus OS answers one question:

> **How do I run myself better today?**

Nexus OS is a private, intelligent personal command system for the user's health, performance, recovery, routines, personal finances, schedule, goals, records, and decisions.

It is not a generic wellness tracker, a social network, a business platform, or a collection of unrelated dashboards. It should help the user understand current state, decide what matters now, take action quickly, and see meaningful trends over time.

### 2.2 Product Character

Nexus OS must feel:

- Personal, private, and trusted
- Powerful without being cluttered
- Advanced without becoming theatrical
- Masculine and disciplined without becoming harsh
- Luxurious without becoming decorative
- Intelligent without pretending certainty
- Calm at rest and immediate in response
- Cohesive across every module

The experience should resemble a private executive intelligence system built for one person—not a corporate admin console, a gaming interface, or a colorful habit app.

### 2.3 Core Product Outcomes

Every feature must contribute to at least one of these outcomes:

1. **Know:** Give the user an accurate, concise picture of personal state.
2. **Decide:** Surface priorities, risks, opportunities, or next best actions.
3. **Act:** Make the important action fast and obvious.
4. **Remember:** Preserve useful personal history, records, and context.
5. **Improve:** Reveal trends and support better personal performance over time.

If a proposed feature does not materially support one of these outcomes, it does not belong in Nexus OS.

### 2.4 The One-Person Rule

Nexus OS is designed primarily for the owner of the system. Multi-user organizational workflows must not be added merely because the underlying technology supports them.

Permitted exceptions are personal relationships or professional support that directly serve the owner—for example, sharing a specific health record with a physician or a household calendar with a partner. Such sharing must be explicit, limited, revocable, and privacy-preserving. It must not turn Nexus OS into team-management software.

---

## 3. Product Scope: What Belongs in Nexus OS

Nexus OS uses a small number of durable personal domains. New capabilities should be placed within these domains before a new top-level module is considered.

### 3.1 Home / Command Center

**Purpose:** Present the clearest possible view of today.

Belongs here:

- Daily briefing
- Current time, date, and relevant context
- Today's priorities
- Calendar summary
- Protocol and medication status
- Workout, recovery, sleep, and nutrition highlights
- Personal finance alerts that need attention
- Atlas summary and suggested next actions
- Meaningful exceptions, risks, or missed commitments
- Quick actions for the user's most common tasks

Standards:

- This is a decision surface, not a wall of metrics.
- The most important information must be visible first.
- Healthy or unchanged states should stay visually quiet.
- Alerts must be prioritized by urgency and consequence, not by module.
- The dashboard must not duplicate every module in miniature.
- A single proprietary “health score” must not hide the underlying signals or imply medical certainty.

The display name may be **Home**, **Command**, **Command Center**, or an explicitly approved brand name such as **Legacy HQ**. Naming changes do not change the module's role.

### 3.2 Protocol

**Purpose:** Safely organize the user's personal health protocol and its history.

Belongs here:

- Medications
- Supplements
- Peptides, when legally and medically appropriate
- Dosage schedules
- Adherence records
- Bloodwork and biomarkers
- Medical notes and related documents
- Refill and inventory reminders
- Clinician instructions
- Side-effect or symptom observations

Standards:

- Protocol data is highly sensitive.
- Doses, units, frequencies, and timestamps must never be ambiguous.
- The interface must distinguish prescribed instructions from personal notes and AI-generated suggestions.
- Atlas must not diagnose, prescribe, or modify a protocol without explicit user action and appropriate clinical framing.
- Safety-critical changes require confirmation and a visible history.
- Inventory in this module means personal medication or supplement supply only—not business inventory.

### 3.3 Fitness

**Purpose:** Plan, execute, and understand physical training.

Belongs here:

- Workout plans
- Active workout experience
- Exercise library
- Sets, reps, load, time, distance, and intensity
- Exercise and workout history
- Personal records
- Cardio and conditioning
- Mobility
- Training load and recovery context
- Progress photos or measurements when explicitly enabled

Standards:

- Logging during a workout must require minimal taps.
- Active-workout controls must be large, legible, and resilient to interruption.
- Units must be explicit and configurable.
- Historical edits must be traceable.
- Progress should emphasize useful patterns, not vanity metrics or guilt.

### 3.4 Sleep and Recovery

**Purpose:** Help the user understand and improve sleep and readiness.

Belongs here:

- Sleep duration and timing
- Sleep stages when a connected source provides them
- Sleep quality and consistency
- Bedtime and wake routines
- Recovery and readiness signals
- Resting heart rate, HRV, respiratory rate, and related source metrics
- User-entered notes and factors
- Trends and correlations

Standards:

- Device-derived estimates must be labeled as estimates.
- Data source and last sync time must be visible.
- Recommendations must account for uncertainty and missing data.
- The system must not shame the user for poor sleep or recovery.

### 3.5 Nutrition and Hydration

**Purpose:** Support personal fueling, hydration, weight, and body-composition goals.

Belongs here:

- Meals and meal history
- Calories and macros when the user wants them
- Hydration
- Weight
- Body measurements
- Food preferences and dietary constraints
- Personal meal planning
- Connections between nutrition, training, sleep, and protocol

Standards:

- Detailed tracking must be optional; the system should work at different levels of precision.
- Common actions must support rapid entry and reuse.
- Weight and body-composition presentation must be factual and respectful.
- The system must clearly distinguish user-entered, estimated, and device-imported values.

### 3.6 Mindset and Reflection

**Purpose:** Support reflection, emotional awareness, personal direction, and mental discipline.

Belongs here:

- Journal
- Daily reflection
- Gratitude
- Mood and energy check-ins
- Vision and personal values
- Guided prompts
- Private notes
- Personal patterns and trends

Standards:

- Entries are private by default.
- Writing must never feel socially performative.
- Prompts should be concise and useful, not sentimental filler.
- Mental-health language must be supportive and must not imply clinical diagnosis.
- Crisis or self-harm experiences require a safety-appropriate response, not ordinary productivity coaching.

### 3.7 Personal Finance

**Purpose:** Give the user an accurate view of personal money and personal obligations.

Belongs here:

- Personal accounts
- Transactions
- Spending and budget
- Personal bills and subscriptions
- Personal cash flow
- Personal net worth
- Credit score and credit monitoring
- Savings, investing, and debt goals
- Personal financial documents and reminders

Standards:

- This module is personal finance only.
- Business books, payroll, invoicing, company accounting, and corporate reporting are excluded.
- Financial calculations must be reproducible and transparent.
- Currency, time period, data freshness, and account source must be visible.
- Sensitive values should support a quick privacy mask.
- Atlas may explain or model choices but must not present personalized financial guidance as guaranteed outcomes.

### 3.8 Calendar, Routines, and Reminders

**Purpose:** Organize personal time and recurring personal commitments.

Belongs here:

- Personal calendar events
- Time blocking
- Personal reminders
- Recurring routines
- Appointments
- Birthdays and important dates
- Travel and personal logistics
- Cross-module schedule items such as workouts or protocol reminders

Standards:

- The system needs one coherent model of time.
- Duplicate events across modules must be avoided.
- Time zone, recurrence, and reminder behavior must be explicit.
- Calendar integrations must state their sync direction and last sync status.
- Destructive recurring-event changes require clear scope selection.

### 3.9 Atlas

**Purpose:** Act as the intelligent concierge and reasoning layer across the user's personal system.

Belongs here:

- Natural-language questions
- Daily and weekly briefings
- Trend explanations
- Cross-module summaries
- Plan creation
- Scenario exploration
- Voice interaction when available
- Drafting reminders, routines, or plans for user approval
- Finding personal information the user is authorized to access

Atlas standards:

- Atlas is a concierge, not an unquestionable authority.
- Atlas must identify missing, stale, estimated, or conflicting data.
- Atlas must separate facts, inferences, and recommendations.
- Atlas must never fabricate personal data or completed actions.
- Atlas must ask for confirmation before consequential writes, sends, purchases, deletions, schedule changes, financial actions, or protocol changes.
- Atlas must show what will change before a multi-record action.
- Atlas access must follow the same permissions as the rest of the product.
- User data must not be used for model training unless the user gives specific, informed, revocable consent.
- Responses should be concise by default and expand on request.
- AI failure must not block direct access to the user's underlying records.

### 3.10 Vault

**Purpose:** Securely organize the user's important personal records.

Belongs here:

- Identification documents
- Insurance documents
- Medical records
- Legal and estate documents
- Warranties and receipts
- Emergency information
- Secure notes
- Password references or links to an approved password manager

Standards:

- The Vault must not casually become a homemade password manager.
- Raw passwords, recovery codes, and secrets require purpose-built encryption and security review before support is considered.
- Sensitive previews should be obscured by default where appropriate.
- Downloads, shares, and deletions must be explicit and auditable.
- Search indexing must not leak protected content into logs or analytics.

### 3.11 Life

**Purpose:** Manage personal goals, habits, learning, interests, and meaningful experiences that do not fit a more specific domain.

Belongs here:

- Personal goals
- Habits
- Reading
- Learning
- Personal checklists
- Bucket list
- Travel aspirations
- Home and vehicle maintenance reminders
- Personal projects that are not company operations

Standards:

- “Life” is not a dumping ground.
- A capability belongs here only if it is personal, useful, and not better represented in another module.
- Personal projects may exist; business projects must not.
- The system should favor a small number of meaningful active goals over an endless backlog.

### 3.12 Settings and Integrations

**Purpose:** Give the user clear control over the system.

Belongs here:

- Profile and preferences
- Units, locale, currency, and time zone
- Appearance within the approved Nexus visual system
- Devices and connected services
- Notifications
- Privacy and security controls
- Data export and deletion
- Atlas permissions
- Accessibility preferences
- Integration health and sync status

Standards:

- Important controls must be understandable without technical knowledge.
- Privacy, export, and deletion cannot be hidden.
- Each integration must show its permissions, sync scope, and current health.
- Disconnecting a service must explain what happens to previously imported data.

### 3.13 Cross-Module Capabilities

These may span modules without becoming top-level destinations:

- Global search
- Notifications and inbox
- Quick capture
- Universal add action
- Data-source and sync status
- Help and support
- Privacy controls
- Export

Cross-module capabilities must use consistent language and interaction patterns everywhere.

---

## 4. Explicitly Out of Scope

Nexus OS must not become a business operating system. The following belong in separate company-specific products:

- Customer relationship management
- Lead pipelines and sales operations
- Business contacts as a CRM
- Company projects and task management
- Team management
- Employee records, scheduling, or performance
- Payroll
- Business accounting or bookkeeping
- Corporate budgets and financial statements
- Invoicing, accounts receivable, or accounts payable
- Company inventory or order management
- Product development management
- Marketing campaigns and content operations
- Customer support systems
- Vendor and procurement management
- Company analytics and executive reporting
- Multi-company command centers
- Business automation unrelated to the user's personal life

Personal information connected to work may be included only when its purpose is to run the individual—for example, a personal appointment, personal compensation record, or reminder to prepare for a meeting. It must not expand into managing the company itself.

When a requested feature is ambiguous, apply this test:

> If the user's company, employees, customers, or products disappeared tomorrow, would this feature still be useful for running the user's personal life?

If the answer is no, the feature belongs in a separate business app.

---

## 5. Information Architecture

### 5.1 Navigation Principles

- Keep top-level navigation small, stable, and predictable.
- Do not make all modules equally prominent at all times.
- On mobile, prioritize **Home**, the most frequent personal actions, and **Atlas**.
- Less-frequent modules may live behind a clearly labeled menu or expandable navigation.
- Navigation position and names must remain consistent across routes.
- A user must always know where they are and how to return.
- Critical actions must not be hidden behind hover-only behavior.
- Avoid nesting deeper than necessary; three levels is the normal maximum.
- Use progressive disclosure to keep advanced detail available without overwhelming the default view.

### 5.2 Screen Hierarchy

Every screen should answer, in order:

1. Where am I?
2. What is my current state?
3. What needs attention?
4. What is the primary action?
5. Where can I see detail or history?

### 5.3 Density

Nexus OS may be information-rich, but it must never feel crowded.

- Group related information into clear surfaces.
- Use hierarchy, spacing, and typography before borders.
- Show summary first and detail on demand.
- Prefer one strong primary action per surface.
- Do not fill empty space simply to make a dashboard look advanced.
- Avoid decorative metrics, fake telemetry, fake maps, meaningless waveforms, and nonfunctional controls.

---

## 6. Visual Identity

### 6.1 Locked Brand Palette

The Nexus OS palette is:

1. **Obsidian black** — the dominant foundation
2. **Dimensional luxury gold** — premium emphasis and high-value accents
3. **Deep masculine green** — intelligence, health, readiness, and active-system energy

**Purple is prohibited.** No violet, lavender, magenta-purple, blue-purple, or purple glow may be introduced as a brand, accent, chart, status, or decorative color.

The interface must also avoid:

- Grainy or noisy color treatments
- Old-world, antique, medieval, baroque, steampunk, or vintage styling
- Muddy bronze or brown presented as gold
- Bright neon green
- Rainbow gradients
- Generic blue SaaS styling
- Excessive gold coverage
- “Gamer” RGB lighting

### 6.2 Color Roles

Obsidian black should represent roughly 70–85% of the visible interface. It provides depth, restraint, and contrast.

Deep masculine green is the principal living accent. It should appear in active states, selected navigation, health and readiness context, controlled glows, data visualization, and system intelligence.

Gold is scarce and intentional. Use it for premium hierarchy, signature moments, exceptional milestones, brand detail, and a limited number of high-value actions. If everything is gold, nothing feels valuable.

Neutral whites and grays are permitted for text, dividers, disabled states, and information hierarchy. Semantic red, amber, and other safety colors may be used when necessary, but must be restrained, accessible, and never mistaken for the brand palette.

### 6.3 Reference Design Tokens

These are implementation starting points, not permission to hardcode colors throughout components. All values must be centralized as semantic tokens and validated on real displays.

```css
--color-canvas: #030504;
--color-surface-1: #070B09;
--color-surface-2: #0B110E;
--color-surface-3: #101914;
--color-border-subtle: rgba(205, 224, 214, 0.10);
--color-border-strong: rgba(205, 224, 214, 0.20);

--color-text-primary: #F3F5F2;
--color-text-secondary: #A8B2AC;
--color-text-muted: #747E78;

--color-green-deep: #0A251A;
--color-green: #155C3D;
--color-green-bright: #36A66F;
--color-green-glow: rgba(40, 151, 98, 0.24);

--color-gold-deep: #7A5A16;
--color-gold: #C9A646;
--color-gold-bright: #F0D277;
--color-gold-glow: rgba(214, 177, 75, 0.20);

--color-danger: #E35D65;
--color-warning: #D99B3D;
--color-info: #78AFC4;
--color-success: #48A875;
```

Gold may use a clean, controlled metallic gradient such as deep gold → clear gold → restrained highlight. It must remain smooth and crisp. Do not add raster noise, film grain, distressed texture, scratches, patina, or brown haze to simulate metal.

### 6.4 Surface Language

Approved surface qualities:

- Clean obsidian fields
- Layered near-black panels
- Subtle translucent glass where readability remains excellent
- Precision borders with low opacity
- Controlled inner highlights
- Refined green or gold illumination
- Smooth metallic accents
- Deep, realistic shadows
- Crisp, high-resolution imagery

Avoid:

- Heavy beveling
- Thick gold frames
- Ornate filigree
- Faux leather, carbon fiber, marble, or wood
- Fog that reduces legibility
- Constant bloom around every element
- Grain overlays
- Dirty textures
- Overuse of glass blur

Depth must come from tonal layering, light, and hierarchy—not visual noise.

### 6.5 Typography

Typography must be modern, highly legible, and restrained.

- Use one approved primary interface family and, at most, one complementary display family.
- Prefer variable fonts and minimize font payload.
- Body copy must never use an ornamental display face.
- Use tabular numerals for time, finance, biometrics, and changing metric values.
- Avoid excessive all-caps. All-caps may be used sparingly for short labels.
- Use weight, size, tone, and spacing to create hierarchy.
- Do not use tiny text to create the illusion of an advanced interface.
- Minimum mobile body size should normally be 16 CSS pixels.

### 6.6 Iconography

- Use one coherent icon family.
- Icons must be crisp, modern, geometric, and recognizable.
- Do not mix outline, filled, 3D, and illustrated icon styles casually.
- Icons supporting actions need labels until their meaning is unquestionably established.
- Decorative sci-fi glyphs that do not communicate meaning are prohibited.
- Status must never be conveyed by color or icon alone; use accessible text or labels as needed.

### 6.7 Data Visualization

- Charts must answer a real question.
- Use green as the normal primary series and gold for a selected, comparative, or milestone series.
- Reserve semantic colors for their actual meanings.
- Label units, ranges, and time periods.
- Provide data-source and freshness context when relevant.
- Avoid 3D charts, decorative radial gauges, and dense dashboards of tiny charts.
- Tooltips must work with touch and keyboard, not hover alone.
- Trends must not imply causation without evidence.
- Missing data must look missing, not like zero.

---

## 7. The `icon.png` Brand Emblem

`icon.png` is the canonical Nexus OS hero emblem supplied by the user. It must be treated as a protected brand asset.

### 7.1 Required Use

- Use it for primary app identity, launch/loading moments, authentication, app metadata, and appropriate branded surfaces.
- Use it as the source for platform-specific icon derivatives.
- Preserve the original file unchanged.
- Create optimized derivatives rather than repeatedly resizing the original at runtime.
- Preserve transparency where supported.
- Maintain the emblem's aspect ratio and visual safe area.
- Provide high-density assets so it remains sharp.

### 7.2 Prohibited Changes

Do not:

- Regenerate or reinterpret the emblem without an explicit user request
- Add “Nexus OS” word text inside the emblem
- Recolor it purple
- Make it predominantly gold
- Add grain, patina, dirt, scratches, or old-world texture
- Stretch, crop, rotate, skew, or distort it
- Place it on a conflicting busy background
- Add an unapproved container, badge, drop shadow, or glow
- Use it as a repeated background pattern

### 7.3 Presentation

The emblem should normally sit on clean obsidian or transparent space with enough room to feel intentional. Supporting glow must be subtle and derived from the approved green or gold tokens. The emblem must never compete with the user's primary task.

If a platform requires a nontransparent icon background, use an approved obsidian field and preserve a generous safe area. Platform-specific masks must be previewed before release.

---

## 8. UX and Interaction Behavior

### 8.1 Default Experience

The default state must feel calm and in control. It should surface exceptions and next actions without creating false urgency.

- Show the most relevant information first.
- Use plain, direct language.
- Keep common actions close to the context that needs them.
- Save user effort with sensible defaults and remembered preferences.
- Do not force the user through setup unrelated to the immediate task.
- Prefer progressive onboarding over a long first-run questionnaire.
- Allow the user to skip nonessential setup.

### 8.2 Action Hierarchy

Each view must clearly distinguish:

- **Primary action:** the one action most likely to advance the current task
- **Secondary actions:** useful but less prominent
- **Tertiary actions:** low-frequency or contextual
- **Destructive actions:** visually distinct, separated, and confirmed when impact is meaningful

Do not place several equal-looking glowing buttons on one screen.

### 8.3 Forms and Data Entry

- Ask only for information needed for the current action.
- Use the correct input type and keyboard.
- Place labels outside or above fields; placeholders are not labels.
- Explain units and accepted formats.
- Validate early without interrupting normal typing.
- Preserve entered data after recoverable errors.
- Support paste, autofill, and password managers where relevant.
- Break long forms into logical steps with visible progress.
- Review safety-critical data before committing.
- Do not use disabled buttons as the only explanation of what is missing.

### 8.4 Feedback

Every user action must have immediate, proportionate feedback.

- Touch/click response: visually immediate, normally within 100 ms
- Local UI acknowledgment: within 100 ms
- Short operation: complete or show progress within 1 second
- Longer operation: show a meaningful loading state after roughly 300–500 ms
- Background operation: allow the user to continue when safe
- Completion: confirm what happened and update the affected state
- Failure: explain what failed, what was preserved, and how to recover

Do not claim “Saved,” “Synced,” “Sent,” or “Complete” until the system has evidence that it occurred.

### 8.5 Undo and Confirmation

- Prefer undo for low-risk, easily reversible actions.
- Require confirmation for destructive, financial, medical, privacy, or broad multi-record actions.
- Confirmation text must name the action and consequence.
- Avoid generic “Are you sure?” dialogs.
- Never use manipulative wording or confusing button order.

### 8.6 Empty States

An empty state must:

1. Explain what the area is for.
2. State why it is empty when known.
3. Offer one clear next action.

Do not fill empty states with fake data unless it is explicitly labeled as a preview or demo.

### 8.7 Error States

Error messages must be:

- Human-readable
- Specific to the failed action
- Safe—not exposing secrets or internal implementation
- Recoverable where possible
- Persistent long enough to read

Log technical detail privately while showing the user the useful next step.

### 8.8 Notifications

- Notifications must earn interruption.
- Default to fewer, higher-value notifications.
- Group related notifications.
- Respect quiet hours and device settings.
- Make category controls available.
- Distinguish informational reminders from time-sensitive or safety-related alerts.
- Never use guilt, fear, or false urgency to drive engagement.

### 8.9 Search

- Search must tolerate ordinary wording, minor errors, and common aliases.
- Results should be grouped by personal domain.
- Highly sensitive content requires permission-aware indexing and display.
- Search must not expose records that the current session cannot access.
- Filters and recent searches may be used when they reduce effort.

---

## 9. Mobile-First and Responsive Standards

Nexus OS must be designed mobile-first, then enhanced for tablet and desktop. Mobile is not a squeezed desktop dashboard.

### 9.1 Mobile

- Primary actions must be reachable and comfortable with one hand where practical.
- Tap targets must be at least 44 × 44 CSS pixels, with adequate separation.
- Bottom navigation or bottom actions may be used for the most frequent destinations.
- Respect safe areas, notches, browser chrome, and virtual keyboards.
- Avoid horizontal page scrolling.
- Tables must transform into useful mobile structures rather than shrink into illegibility.
- Sheets and full-screen flows should be used intentionally.
- Active workout, protocol, quick capture, and Atlas interactions must remain usable under interruption.

### 9.2 Tablet

- Use the additional space for master-detail layouts, supporting context, and persistent navigation.
- Do not simply scale mobile cards until they become oversized.
- Support portrait and landscape.

### 9.3 Desktop

- Increase information density carefully.
- Use side navigation and multi-column layouts when they improve comprehension.
- Preserve reasonable line lengths and content widths.
- Support keyboard navigation and shortcuts for frequent actions.
- Do not stretch a single mobile column across a large display.

### 9.4 Responsive Validation

Every affected screen must be tested at:

- A small supported phone width
- A modern standard phone width
- Tablet portrait or equivalent intermediate width
- Desktop
- A wide desktop width

Also test text zoom, landscape mobile when relevant, virtual keyboard overlap, and long real-world content.

---

## 10. Motion Standards

Motion communicates continuity, hierarchy, and response. It must never be used to make an unfinished interface look premium.

### 10.1 Motion Character

Motion must feel:

- Precise
- Smooth
- Controlled
- Confident
- Fast
- Physically coherent

Avoid:

- Bouncy toy-like easing
- Constant ambient animation
- Large parallax effects
- Excessive particle systems
- Flickering scan lines
- Fake boot sequences
- Slow cinematic transitions during routine work
- Animations that delay access to information

### 10.2 Timing Guidance

- Micro-feedback: approximately 80–160 ms
- Standard transition: approximately 160–240 ms
- Larger panel or route transition: approximately 220–320 ms
- Use longer timing only for a rare, intentional brand moment

Use transform and opacity where practical. Avoid animating layout properties that create jank.

### 10.3 Reduced Motion

- Honor `prefers-reduced-motion`.
- Remove nonessential movement.
- Replace spatial transitions with simple fades or immediate state changes.
- Never require animation to understand status or hierarchy.

### 10.4 Loading Motion

Loading animation must indicate genuine activity. Never use elaborate animation to conceal avoidable latency. Skeletons should match the incoming layout and must not pulse aggressively.

---

## 11. Component Standards

### 11.1 Design System First

All product UI must be built from a shared system of:

- Semantic design tokens
- Typography styles
- Spacing and sizing scales
- Layout primitives
- Buttons and icon buttons
- Inputs and selection controls
- Cards and panels
- Navigation
- Dialogs, sheets, and popovers
- Tables and lists
- Badges and status indicators
- Charts and metric displays
- Toasts and inline messages
- Skeleton, empty, error, and offline states

Do not create a one-off visual language for each module.

### 11.2 Token Rules

- Components must use semantic tokens, not scattered literal values.
- Token names must describe purpose, not merely color.
- Light mode must not be invented unless explicitly requested.
- Brand, semantic status, and data-series colors must remain distinct concepts.
- Spacing and radii must come from a limited scale.
- Z-index values must be managed as layers, not arbitrary large numbers.
- Shadows and glow must be tokenized and restrained.

### 11.3 Component API Rules

- Components should have clear, typed interfaces.
- Prefer composition over large collections of boolean options.
- Variants must represent real design-system choices.
- Business-domain logic must not be buried inside generic visual components.
- Interactive components must expose focus, disabled, loading, error, and success behavior as applicable.
- Custom controls must match native keyboard and assistive-technology expectations.

### 11.4 Buttons

- One primary button style per context.
- Button labels must use clear verbs.
- Icon-only buttons require accessible names and tooltips when useful.
- Loading buttons must preserve width and prevent accidental duplicate submission.
- Disabled controls must remain legible.
- Gold buttons are reserved for rare brand-signature or premium actions; green is the normal active/action accent.

### 11.5 Cards and Panels

- A card must represent a meaningful group, not every individual line.
- Avoid nested-card overload.
- Use surface tone and spacing before heavy borders.
- Interactive cards must be distinguishable from static cards.
- Entire-card click targets must not create ambiguous nested interactions.

### 11.6 Dialogs, Sheets, and Menus

- Use a dialog only when attention must be temporarily focused.
- Use mobile sheets for contextual actions that remain understandable.
- Do not stack dialogs.
- Focus must enter, remain within, and return correctly.
- Escape/back behavior must be safe and predictable.
- Destructive actions should not be the default focused action.

---

## 12. Loading, Sync, Offline, and Interaction States

Every data-driven surface must define the following states where applicable:

1. Initial loading
2. Loaded with data
3. Empty
4. Refreshing with existing data
5. Partial data
6. Stale data
7. Offline
8. Permission denied
9. Recoverable error
10. Unrecoverable or unsupported state

### 12.1 Loading

- Prefer useful shell rendering over blank screens.
- Do not block the whole app for a single panel request.
- Skeletons must preserve layout and reduce visual shifting.
- Avoid indefinite spinners without context.
- Long tasks should show stage or progress when it can be measured honestly.

### 12.2 Optimistic Updates

Optimistic UI may be used when:

- The action is low risk.
- Failure can be rolled back clearly.
- The user will not be misled about a consequential result.

Do not use optimistic confirmation for sensitive financial actions, protocol changes, external sends, destructive operations, or any action whose success cannot be safely assumed.

### 12.3 Sync

- Show last successful sync time when freshness matters.
- Distinguish syncing, synced, delayed, stale, and failed.
- Preserve local user input during transient failures.
- Resolve conflicts explicitly; do not silently overwrite newer information.
- Background sync should not interrupt the current task.
- Imported values must retain source provenance.

### 12.4 Offline and Degraded Use

- Core read access should degrade gracefully where technically feasible.
- Queue safe local changes when conflict risk is controlled.
- Clearly mark actions that require connectivity.
- AI unavailability must not make manually stored personal records inaccessible.
- Third-party integration failure must be isolated from unrelated modules.

---

## 13. Performance Standards

Speed is part of the luxury experience. The interface must feel immediate on ordinary mobile hardware and realistic network conditions, not only on a developer laptop.

### 13.1 User-Experience Targets

For production web surfaces, target at least:

- Largest Contentful Paint: **2.5 seconds or less at the 75th percentile**
- Interaction to Next Paint: **200 ms or less at the 75th percentile**
- Cumulative Layout Shift: **0.10 or less**
- Immediate press/tap feedback: **100 ms or less**
- Smooth motion: **60 frames per second where the display and platform allow**

These are minimum acceptance targets, not reasons to stop optimizing.

### 13.2 Loading Strategy

- Render critical content first.
- Split code by route or capability.
- Lazy-load heavy charts, editors, AI panels, and rarely used settings.
- Avoid shipping entire icon, chart, date, or utility libraries when a small subset is used.
- Optimize and size images correctly.
- Preload only truly critical resources.
- Use stable dimensions to prevent layout shift.
- Cache deliberately and provide invalidation rules.
- Avoid sequential network waterfalls when safe requests can run concurrently.

### 13.3 Runtime

- Prevent unnecessary rerenders.
- Virtualize only long lists that need it; do not add complexity prematurely.
- Paginate or incrementally load large histories.
- Move expensive computation away from the critical interaction path.
- Cancel obsolete requests.
- Debounce intentionally, without making controls feel delayed.
- Avoid persistent high-cost blur, filter, shadow, and animation effects.
- Monitor memory use in long-running sessions and active workout flows.

### 13.4 Network and Data

- Request only fields needed by the screen.
- Compress payloads and static assets.
- Avoid repeated requests for unchanged personal data.
- Use background refresh without clearing visible valid data.
- Protect against retry storms.
- Set timeouts and useful failure behavior for integrations.

### 13.5 Performance Verification

Every material feature must be checked on:

- A production build
- A throttled or mid-tier mobile profile
- A populated realistic dataset
- Slow or failed integration responses
- Repeated navigation and long-session use when relevant

A visually impressive feature that causes jank, blocks input, or delays essential information is not acceptable.

---

## 14. Architecture Principles

These principles apply regardless of the chosen framework or backend.

### 14.1 Domain-Oriented Structure

- Organize product logic around personal domains: protocol, fitness, sleep, nutrition, finance, calendar, Atlas, Vault, and so on.
- Keep shared infrastructure separate from domain logic.
- Do not create a single global module that knows every feature.
- Define clear boundaries and contracts between domains.
- Cross-module insights should read through deliberate interfaces, not reach into internal implementation.

### 14.2 Layering

Keep these concerns distinguishable:

1. Presentation and interaction
2. Application workflows
3. Domain rules
4. Data access and integrations
5. Infrastructure and platform services

Visual components must not directly embed persistence, authentication, financial calculations, or medical-domain rules.

### 14.3 Data Contracts

- Use explicit, validated contracts at boundaries.
- Prefer typed data structures.
- Treat third-party data as untrusted.
- Normalize units, timestamps, time zones, currencies, and source identifiers.
- Version persisted and external-facing schemas.
- Make migrations reversible or recoverable where practical.
- Preserve raw source values when transformation could lose meaning.

### 14.4 State

- Keep server/remote state distinct from temporary interface state.
- Avoid one giant global state store.
- Store derived values as derivations when possible, not duplicated mutable state.
- Define cache ownership and invalidation.
- Sensitive state must not persist in insecure browser or device storage.

### 14.5 Integrations

- Place each external service behind an adapter.
- The product must not be designed around one vendor's quirks.
- Store provenance and sync timestamps.
- Handle partial permissions, revoked access, rate limits, duplicate records, and schema changes.
- Make integration health observable.
- A failed integration must not crash the app.

### 14.6 Configuration

- Keep environment-specific values outside source code.
- Never commit credentials or secrets.
- Validate required configuration at startup.
- Use safe defaults.
- Feature flags must have owners, intended lifetime, and cleanup plans.

### 14.7 Failure Isolation

- Module failures should remain local when possible.
- Atlas failure must not break direct manual workflows.
- Analytics failure must never block the product.
- Noncritical visual effects must never block content.
- Provide error boundaries or equivalent protection at meaningful feature boundaries.

### 14.8 Maintainability

- Prefer clear, ordinary solutions over clever abstractions.
- Abstract after a pattern is understood, not before.
- Remove dead code and obsolete flags as part of the work that makes them obsolete.
- Keep dependencies deliberate and current.
- Record important architectural decisions.
- Leave changed areas cleaner, but do not expand a task into an unrelated rewrite.

---

## 15. Data, Privacy, and Security

Nexus OS contains health, financial, identity, behavioral, and deeply personal data. Privacy and security are product features, not backend details.

### 15.1 Privacy Principles

- Collect the minimum data required.
- State why sensitive data is needed.
- Keep data private by default.
- Obtain explicit consent for new categories of collection or sharing.
- Make consent specific, informed, and revocable.
- Do not sell personal data.
- Do not use personal data for advertising profiles.
- Do not use personal data for AI training without explicit opt-in consent.
- Provide clear export and deletion controls.
- Define retention periods instead of keeping all data forever by accident.

### 15.2 Security Baseline

- Encrypt data in transit with current secure protocols.
- Encrypt sensitive data at rest.
- Use strong authentication and secure session management.
- Support device/session review and revocation.
- Use least-privilege authorization.
- Protect sensitive operations with recent authentication when appropriate.
- Keep secrets on trusted server infrastructure, not in client code.
- Use secure platform storage for device-held sensitive tokens.
- Apply rate limits and abuse protection.
- Keep dependencies and runtime environments patched.
- Maintain tested backup and recovery procedures.

### 15.3 Sensitive Data Handling

- Never log full tokens, passwords, financial account numbers, medical record contents, government identifiers, or Vault documents.
- Redact sensitive values in diagnostics.
- Prevent sensitive content from appearing in URLs.
- Avoid placing sensitive personal data in push-notification text by default.
- Mask sensitive values in app-switcher previews where supported and appropriate.
- Limit analytics event properties to non-sensitive operational metadata.

### 15.4 Authorization

- Every sensitive read and write must be authorized at the trusted data boundary.
- Hiding a button is not authorization.
- Record ownership must be enforced consistently.
- Sharing must be explicit, scoped, expiring where appropriate, and revocable.
- Administrative access must be rare, logged, and controlled.

### 15.5 Auditability

High-consequence actions should record:

- What changed
- When it changed
- Who or what initiated it
- Prior and new values when safe and appropriate
- Source or integration
- Whether Atlas proposed or performed part of the workflow

Audit records themselves must not leak more sensitive data than necessary.

### 15.6 Data Portability and Deletion

- The user must be able to export personal data in understandable, portable formats.
- Export should include source and timestamp context.
- Deletion must explain scope, delay, backups, and irreversible effects.
- Account deletion must not be a deceptive maze.
- Legal or safety retention requirements, if any, must be stated clearly.

### 15.7 Medical and Financial Boundaries

- Nexus OS may organize information, display trends, and support informed decisions.
- It must not misrepresent itself as a physician, emergency service, financial adviser, bank, or fiduciary.
- High-stakes suggestions must include appropriate uncertainty and escalation to qualified professionals.
- Calculations and recommendations must expose assumptions.

---

## 16. Accessibility

Nexus OS must target **WCAG 2.2 Level AA** across supported experiences. Accessibility is required even when it constrains a visual effect.

### 16.1 Visual

- Normal text must meet at least 4.5:1 contrast.
- Large text must meet at least 3:1 contrast.
- Meaningful non-text interface elements must meet applicable contrast requirements.
- Never use color alone to communicate status.
- Text must remain usable at 200% zoom.
- Layout must reflow without loss of meaning or function.
- Focus indicators must be visible against obsidian, green, and gold surfaces.
- Gold text on black must be contrast-tested; “looks bright” is not sufficient.

### 16.2 Keyboard and Focus

- Every action must be keyboard accessible on platforms with keyboards.
- Focus order must follow the visual and logical order.
- No keyboard traps.
- Dialog focus must be managed correctly.
- Skip navigation must be available for complex application shells.
- Keyboard shortcuts must not conflict with assistive technology and must be discoverable.

### 16.3 Semantics

- Use native semantic elements whenever possible.
- Provide correct names, roles, states, and relationships.
- Inputs need persistent labels and accessible error association.
- Headings must form a logical hierarchy.
- Tables must have appropriate headers.
- Charts need accessible summaries or equivalent data access.
- Live status messages must be announced without overwhelming the user.

### 16.4 Touch, Motion, and Cognition

- Touch targets must be at least 44 × 44 CSS pixels.
- Honor reduced motion.
- Avoid time limits unless essential; provide control when they are required.
- Use plain, concise language.
- Keep interaction patterns consistent.
- Do not depend on memory across long multi-step flows; show context and progress.

### 16.5 Accessibility Verification

Every material feature must receive:

- Automated accessibility checks
- Keyboard-only testing
- Screen-reader smoke testing
- Contrast validation
- Zoom/reflow testing
- Reduced-motion testing when motion is present

Automated checks alone are not sufficient.

---

## 17. Content and Voice

Nexus OS should sound like a precise, trusted private concierge.

### 17.1 Voice

Use language that is:

- Clear
- Direct
- Calm
- Intelligent
- Respectful
- Concise
- Specific

Avoid language that is:

- Cute or childish
- Corporate and bureaucratic
- Overly clinical when plain language works
- Hype-heavy
- Vague
- Shame-based
- Needlessly militarized
- Fake-futuristic

### 17.2 Interface Copy

- Prefer verbs that describe the actual action.
- Name the object being changed.
- Use sentence case.
- Keep labels stable across modules.
- Explain consequences before high-impact actions.
- Use exact dates and times where relative wording could be ambiguous.
- Do not call an estimate a fact.
- Do not call an unsynced local change “synced.”

### 17.3 Atlas Copy

Atlas should:

- Lead with the useful answer.
- State important uncertainty.
- Cite the relevant personal data source or date when it matters.
- Distinguish observation from recommendation.
- Avoid long preambles.
- Offer detail rather than forcing it.
- Never use false confidence to sound advanced.

---

## 18. Quality, Testing, and Observability

### 18.1 Required Test Layers

Use the test layers appropriate to the change:

- Unit tests for domain rules and calculations
- Component tests for interaction states
- Integration tests for data boundaries and adapters
- End-to-end tests for critical personal workflows
- Visual regression tests for design-system and high-value screens
- Accessibility tests
- Performance checks
- Security testing for sensitive flows

### 18.2 Critical Workflows

At minimum, protect relevant portions of these flows:

- Sign in, session recovery, and sign out
- View today's command center
- Log and edit a workout
- Record or confirm a protocol item
- View sleep/recovery data and source freshness
- Add a meal, hydration, or weight entry
- Create and update a personal finance record
- Create and modify a recurring event
- Ask Atlas a cross-module question
- Confirm or reject an Atlas-proposed action
- Upload, view, share, export, and delete a Vault record
- Export and delete personal data
- Disconnect an integration

### 18.3 Realistic Data

- Test empty, typical, and large datasets.
- Test long names, large financial values, multiple units, time zones, and daylight-saving transitions.
- Test missing, stale, duplicate, conflicting, and malformed integration data.
- Never use real sensitive personal data in general test fixtures.

### 18.4 Observability

- Capture errors with enough context to diagnose them, but redact sensitive values.
- Measure latency, failure rates, sync health, and user-visible performance.
- Use correlation identifiers instead of logging entire payloads.
- Alert on failures that compromise access, data integrity, security, or critical reminders.
- Analytics and diagnostics must never block primary workflows.

### 18.5 No Fake Completion

A feature is not complete because a screen exists. It must handle:

- Real data
- All relevant states
- Mobile and desktop
- Accessibility
- Failure and recovery
- Privacy and permissions
- Performance
- Verification

---

## 19. Mandatory Rules for Every Future Codex Build Prompt

Before changing Nexus OS, Codex must:

1. Read this entire standards document.
2. Inspect the existing repository, its instructions, current architecture, design tokens, components, tests, and uncommitted changes.
3. Preserve user changes and avoid unrelated rewrites.
4. State which approved personal module the work belongs to.
5. Confirm that the requested feature passes the personal-versus-business boundary.
6. Identify the user outcome and primary workflow.
7. Reuse existing design-system patterns before adding new ones.
8. Define data, loading, empty, error, offline, and permission states.
9. Identify privacy, security, medical, financial, or destructive-action risk.
10. Set an appropriate verification plan.

During implementation, Codex must:

1. Keep the work within the requested scope.
2. Preserve the obsidian, deep masculine green, and dimensional luxury gold visual system.
3. Use **no purple**.
4. Use **no grainy, distressed, antique, or old-world styling**.
5. Keep gold scarce; do not turn the interface predominantly gold.
6. Keep the design advanced, modern, crisp, and ultra-refined.
7. Use `icon.png` according to the protected asset rules.
8. Build mobile-first and verify all supported widths.
9. Use semantic tokens and shared components.
10. Keep common interactions immediate and accessible.
11. Keep domain logic out of generic visual components.
12. Validate all external and user-provided data.
13. Keep secrets and sensitive data out of client code, URLs, logs, and analytics.
14. Add or update tests proportionate to risk.
15. Avoid fake data, fake controls, fake sync, and fake completion.
16. Avoid adding dependencies without a clear benefit and review of cost.
17. Avoid changing unrelated files.
18. Never commit, push, deploy, delete data, send messages, or perform consequential external actions unless the user has authorized that action.

Before handing off, Codex must:

1. Run the relevant formatting, type, lint, test, accessibility, and production-build checks.
2. Inspect the finished interface visually at mobile and desktop sizes.
3. Test the affected workflow with realistic states and failures.
4. Confirm no purple, grain, excessive gold, or inconsistent component styling was introduced.
5. Confirm performance did not materially regress.
6. Confirm sensitive values are not exposed.
7. Summarize exactly what changed.
8. State what was verified and disclose any check that could not be completed.
9. Call out migrations, new configuration, dependencies, and known limitations.
10. Never describe unverified behavior as working.

---

## 20. Standard Build-Prompt Contract

Future Nexus OS requests should use or answer this contract. Codex should infer safe details from the repository where possible and ask only when a missing choice would materially change the product.

```markdown
# Nexus OS Build Request

## Objective
[What personal outcome should improve?]

## Approved module
[Home / Protocol / Fitness / Sleep and Recovery / Nutrition and Hydration /
Mindset and Reflection / Personal Finance / Calendar / Atlas / Vault / Life /
Settings and Integrations]

## User workflow
[Starting state → key actions → successful outcome]

## In scope
- [...]

## Out of scope
- [...]

## Data and integrations
- Data source:
- Data written:
- Sync/freshness expectations:
- Permissions:
- Sensitive-data classification:

## Required states
- Loading
- Loaded
- Empty
- Refreshing
- Partial/stale
- Offline
- Permission denied
- Error/retry
- Success/undo where applicable

## Visual and interaction requirements
- Follow NEXUS_OS_CODEX_STANDARDS.md
- Obsidian black + deep masculine green + restrained dimensional luxury gold
- No purple
- No grainy, distressed, antique, or old-world styling
- Mobile-first
- Reuse existing tokens and components
- Use icon.png only according to brand-asset rules

## Acceptance criteria
- [...]

## Verification
- Relevant automated tests
- Production build
- Mobile/tablet/desktop visual check
- Keyboard and accessibility check
- Slow/failure-state check
- Performance check
- Privacy/security review where relevant

## Delivery boundary
[Local changes only / commit requested / push requested / deployment requested]
```

Codex must not treat omitted deployment, commit, push, or external-action instructions as permission to perform them.

---

## 21. Definition of Done

A Nexus OS change is done only when all applicable items below are true.

### Product

- The work improves a defined personal outcome.
- It belongs to an approved module.
- It does not introduce business-app scope.
- The primary workflow is clear and complete.
- It uses real functionality rather than decorative simulation.

### Design

- The experience is modern, futuristic, masculine, and luxurious.
- Obsidian is dominant.
- Green is the normal active intelligence accent.
- Gold is dimensional, clean, and restrained.
- No purple appears.
- No grainy, dirty, distressed, or old-world treatment appears.
- `icon.png` is used correctly if the brand emblem is present.
- The result is cohesive with existing screens.

### Interaction

- Primary actions are obvious.
- Feedback is immediate.
- Loading, empty, stale, offline, error, and success states are handled.
- Destructive or high-consequence actions are safe and explicit.
- Long operations do not unnecessarily block the app.

### Responsive and Accessible

- Mobile-first behavior is correct.
- Tablet and desktop layouts are intentional.
- Touch targets, keyboard use, focus, semantics, contrast, zoom, and reduced motion are verified.
- The applicable WCAG 2.2 AA requirements are met.

### Engineering

- Domain boundaries are respected.
- Data contracts are explicit and validated.
- Sensitive information is protected.
- Integration failures are isolated.
- Dependencies are justified.
- Tests cover the material behavior and risk.
- The production build passes.

### Performance

- Critical content loads first.
- Interactions remain responsive.
- Motion is smooth and restrained.
- Payload and runtime cost are appropriate.
- No material regression is introduced.

### Handoff

- Changed files and behavior are summarized accurately.
- Verification results are reported.
- Known limitations are explicit.
- No unauthorized commit, push, deploy, data deletion, or external action occurred.

---

## 22. Decision Hierarchy

When tradeoffs are necessary, use this order:

1. User safety and data integrity
2. Privacy and security
3. Correctness and truthful system state
4. Personal product scope
5. Accessibility
6. Task completion and clarity
7. Performance and reliability
8. Visual coherence and luxury
9. Motion and decorative enhancement

Visual spectacle must never outrank clarity, speed, accessibility, privacy, or correctness.

---

## 23. Final Product Standard

The best version of Nexus OS is not the version with the most modules, cards, metrics, or AI.

It is the version that:

- Gives the user a commanding view of today
- Keeps personal information accurate and private
- Makes important actions fast
- Connects relevant personal domains intelligently
- Looks unmistakably premium and modern
- Remains calm, crisp, and responsive
- Earns trust every time it reports, recommends, saves, syncs, or acts

Every future build should make Nexus OS feel more like one coherent personal operating system—and never like a pile of features.

