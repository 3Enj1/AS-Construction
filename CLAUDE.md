# AS Construction Hub — Project Brief

## What this is
A construction company operations app: projects, tasks with approvals,
materials inventory, worker clock-in/out, per-project chat, and reusable
project templates. Backend is real Supabase, not mock data, for most
features — see "Known gaps" below for what's still stubbed.

## Stack
- Frontend: React 19 + TanStack Start + TanStack Router + Vite + Tailwind v4
- Backend: Supabase (Postgres, Auth, Realtime, Storage, RLS)
- Deployment target: Cloudflare (`wrangler.jsonc` + `@cloudflare/vite-plugin`)
- State/data fetching: TanStack Query (`useQuery`/`useMutation`) calling
  hand-written functions in `src/lib/*-actions.ts` that call the Supabase
  JS client directly. Privileged/auth-sensitive operations (e.g. login
  code→email resolution) run server-side via TanStack Start `createServerFn`
  using a service-role client — see `src/lib/auth.functions.ts`.

## Non-negotiable conventions
- User-toggleable light/dark theme with the AS red brand accent (dark was
  the sole theme until light mode was added; default follows
  `prefers-color-scheme`, overridable via the header toggle and persisted
  to `localStorage`). Theme tokens live in `src/styles.css` — `:root` is
  the light palette, `.dark` overrides it (`--brand`, `--danger`,
  `.as-card`, `.as-card-glass`, `shadow-glow-brand`, etc). Theme state is
  `src/lib/theme-context.tsx` (`ThemeProvider`/`useTheme`), toggled via
  `src/components/theme/ThemeToggle.tsx`. Reuse existing primitives in
  `src/components/ui`. Never introduce a new styling system.
- Roles are `app_role`: `admin | project_manager | site_supervisor | worker
  | subcontractor | client` (6, not 3). Authorization source of truth is
  the `user_roles` table plus the `has_role()`, `current_profile_id()`,
  and `is_project_member()` SQL helper functions — `profiles.role` is
  descriptive only, not authoritative. Enforce access with RLS, not just
  UI hiding.
- Mobile-first for worker-facing screens (clock-in, tasks, chat).
- Realtime: today only `chat.tsx` uses Supabase Realtime — `chat_messages`
  is the only table in the `supabase_realtime` publication, via
  `.channel(...).on('postgres_changes', ...)`. Follow that same pattern
  when adding realtime to another feature; don't invent a different
  mechanism (e.g. polling) unless asked.
- Data mapping: DB snake_case/enum rows are converted to UI-facing
  camelCase types with human-readable labels via mapper functions
  (`src/lib/project-mapper.ts`, `src/lib/task-mapper.ts`). Add new fields
  there rather than leaking raw DB shapes into components.

## Database schema (source of truth: `supabase/migrations/*.sql`, 8 files)
- `profiles` — one row per `auth.users` row (auto-created by a
  `handle_new_user()` trigger), holds `employee_code`, `email`, `role`,
  `is_active`, `has_accepted_terms`, archive fields.
- `user_roles` (`user_id, role`) — authoritative role grants, checked by
  `has_role()`.
- `projects` — status (`planning|active|on_hold|completed|cancelled|archived`),
  priority, assigned PM/supervisor, client link. **No stored/computed
  progress column or view exists.**
- `project_phases`, `tasks` (status enum has 10 values: `not_started →
  assigned → in_progress → blocked/awaiting_materials →
  submitted_for_review → approved/rejected → overdue → archived`),
  `task_updates`, `task_photos`, `task_suggestions`, `task_comments`.
- `project_templates` + `task_templates` (with `category`) — clone-tasks
  templating feature, already built and in scope.
- `materials` (`stock numeric`, `threshold`), `material_requests`
  (`pending|approved|denied|delivered`).
- `attendance_logs` (`active|on_break|completed`, `break_started_at`).
- `chat_messages` — realtime-enabled.
- `notifications` (`for_user_id`/`for_role`, `kind: info|warning|success|danger`).
- Storage buckets exist with RLS but are unused by client code:
  `profile-avatars` (public), `task-photos`, `project-documents`,
  `material-receipts`, `report-exports` (all private).

## Known gaps — do not assume these are already solved
- **No materials ledger.** `materials.stock` is a plain mutable column,
  written directly from `src/lib/project-actions.ts`
  (`reviewMaterialRequest`, `addMaterial`) using an optimistic-concurrency
  `update(...).gte('stock', quantity)` guard — there is no
  `material_transactions` table or DB trigger. If a ledger is wanted,
  it's new work, not a refactor of something broken.
- **No computed progress/budget.** `mapDbProject` hardcodes
  `progress: 0, budget: 0, spent: 0, phases: []`. No DB view computes
  task-completion progress.
- **Notifications page and Performance dashboard still read from
  `src/lib/demo-data.ts`**, not the real `notifications`/`tasks` tables.
- **Uploads page (`uploads.tsx`) is fully static placeholder data** — no
  Supabase Storage wiring, despite the buckets existing.
- **Reports page** has "Coming soon" placeholders for budget-vs-actuals
  and job-card PDF export.
- `src/lib/demo-data.ts` itself is intentionally still present — its
  header comment says it's meant to be deleted once every mock page is
  migrated; don't delete it until the last consumer is gone.

## Out of scope for v1 — do not build even if it seems helpful
⬅️ FILL IN — this is a product decision, not something inferable from
code. (Note: unlike a from-scratch build, this repo already ships a
template builder and a 6-role model, so don't assume either is
descoped by default.)

## Workflow rules for you (Claude Code)
- Work only on the task in the current prompt. Do not refactor unrelated
  code or "improve" things outside scope.
- After DB changes, write the SQL as a migration file in
  `supabase/migrations/`, don't just apply it silently.
- After finishing, list exactly what you changed and how to test it.
- If something in the codebase contradicts this brief, stop and ask.
