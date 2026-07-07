## Goal

Keep the existing dark AS Construction UI, navigation, dashboards, and mobile-first layouts. Replace the localStorage demo backend with a real Supabase backend (auth, database, storage, RLS, notifications, uploads) so the app becomes a working production MVP.

This is a very large migration. To stay safe and reviewable, I'll deliver it in **5 phases**, each ending in a working app. After each phase you can test, then say "continue" for the next.

---

## Phase 1 — Foundation: Auth, Profiles, Roles, RLS

**Database (one migration)**
- enum `app_role`: admin, project_manager, site_supervisor, worker, subcontractor, client
- `profiles` table (all fields from spec) with `auth_user_id` → `auth.users`
- `user_roles` table (separate, to avoid privilege-escalation) + `has_role(uid, role)` SECURITY DEFINER
- `acknowledgements` columns on profiles (`has_accepted_terms`, `accepted_at`)
- `handle_new_user()` trigger so each new auth user gets a profile row
- RLS on profiles + user_roles (self-read, admin-manage via `has_role`)
- Seed: Andrew Stuart admin + one user per role with the employee codes from spec (ASC-ADM-001 etc.)

**Auth flow**
- Login form keeps "Employee Code + Password" UI. Under the hood we map `employee_code → email` via a server function (RPC) that looks up the profile, then call `supabase.auth.signInWithPassword` with the resolved email.
- No public signup. Admin "Add user" calls a server function using `supabaseAdmin.auth.admin.createUser` + inserts profile + role.
- First-login acknowledgement screen wired to `profiles.has_accepted_terms`.
- Replace `auth-context.tsx` to use real Supabase session (`onAuthStateChange`, profile fetch, role detection, redirect by role).
- `_authenticated` layout adds `beforeLoad` session check + redirect.

**Storage**
- Create buckets: `profile-avatars`, `task-photos`, `project-documents`, `material-receipts`, `report-exports` with appropriate RLS.

End state: real login works, role-based dashboards load, acknowledgement enforced, admin can create users.

---

## Phase 2 — Projects, Phases, Tasks, Templates

- Tables: `projects`, `project_phases`, `tasks`, `task_updates`, `task_photos`, `task_suggestions`, `task_comments`, `project_templates`, `task_templates`
- RLS:
  - admin/PM: full access
  - supervisor: all projects, but task approval/assign only
  - worker/subcontractor: only their assigned tasks/projects
  - client: only projects where they're the client + only client-visible updates
- Seed default template "New Residential Home Build" with the 9 phases from spec + realistic tasks
- Server functions:
  - `createProjectFromTemplate(templateId, projectData)` → inserts project + phases + tasks
  - `submitTaskForReview`, `approveTask`, `rejectTask`
- Wire existing pages (`/projects`, `/projects/:id`, `/tasks`) to live data via TanStack Query
- Worker task actions: progress note, photo upload (Supabase Storage), submit-for-review, suggest task

---

## Phase 3 — Attendance, Materials, Requests

- Tables: `time_logs`, `break_logs`, `time_log_edits`, `project_materials`, `material_usage`, `material_requests`
- Clock-in/out: GPS via `navigator.geolocation`, server function stores coordinates + computes `total_hours` and `net_working_hours` at clock-out
- Tea/Lunch break start/end buttons
- Material usage trigger: on insert into `material_usage`, deduct from `project_materials.quantity_remaining`; if under `minimum_alert_quantity`, fire notification
- Material requests: worker/supervisor create → admin approve/deny/purchase flow
- Wire `/clock`, `/attendance`, `/materials`, `/material-requests` pages

---

## Phase 4 — Notifications, Chat, Reports

- Tables: `notifications`, `project_chat_messages`, `whatsapp_queue` (placeholder)
- DB triggers create notifications on: task assigned, submitted, approved/rejected, overdue, material request lifecycle, low stock, new progress photo, task suggestion, chat mention
- Realtime subscription in `/notifications` and `/chat`
- Reports page: real queries (hours worked, completed tasks, project progress, material usage, overdue tasks, low-material). CSV export buttons wired; PDF export stub.

---

## Phase 5 — Archiving, Polish, Demo Data

- Soft-delete helpers (`is_archived`, `archived_at`, `archived_by`, `archive_reason`) on major tables; `/archive` page shows archived records with restore action
- Full realistic demo seed: 2 projects with phases + tasks, materials, requests, attendance/breaks, updates, photos placeholders, notifications, chat
- Final pass: remove `demo-data.ts` usage from all pages, verify each role's dashboard with seeded accounts

---

## Technical notes

- All server-side logic uses TanStack `createServerFn` (this stack's pattern), not Supabase Edge Functions.
- Admin user creation uses `supabaseAdmin` (service role) in a server function gated by `has_role(uid,'admin')`.
- Employee-code → email lookup runs as an unauthenticated server function using `supabaseAdmin` with a single safe SELECT.
- `attachSupabaseAuth` already wired in `src/start.ts` per template.
- Keep all existing components, styles, layouts, dashboards. Only swap data sources + add forms/actions.

---

## What I need from you to start

Reply **"go phase 1"** and I'll run the Phase 1 migration + wire real auth. You'll review each phase before I move to the next.

If you want me to merge phases or change priorities (e.g. "do auth + projects in one shot"), tell me now.
