
# IO-Gen — Business Operations Platform

A collaborative internal tool with module-level access control, in-app + email notifications, a global activity feed, calendar, and per-user Gmail outreach.

## Tech & Setup

- TanStack Start + Tailwind + shadcn/ui (already scaffolded)
- Lovable Cloud (Supabase) for DB, auth, storage, RLS
- Lovable Emails for system/notification emails
- Per-user Gmail OAuth (custom flow with your own Google Cloud OAuth client) for sending outreach as the signed-in user
- Logo: please share the IO-Gen logo file in the next message (I didn't receive an attachment) — I'll drop it into `src/assets/`

## Design

- Inspired by craft.do: generous whitespace, soft cards, subtle dividers, rounded corners, restrained motion
- Palette: gradient greens (emerald/teal) + warm greys, defined as oklch tokens in `src/styles.css`
- Sidebar layout (collapsible) + top bar with global search, notification bell, user menu

## Modules / Routes

```
/login                              public
/_authenticated
  /                                 Dashboard (KPIs + global activity feed)
  /calendar                         Unified calendar (due dates, posts, renewals, milestones)
  /crm                              Contacts + Organisations
    /contacts, /contacts/$id
    /organisations, /organisations/$id
  /outreach                         Campaigns list
    /$campaignId                    Contacts table (statuses, dates, notes, bulk import/export)
    /$campaignId/send/$contactId    Compose & send via user's Gmail
    /templates                      Email templates (approval, sharing)
  /social                           Social planner (board + list)
    /$planId
  /projects                         Projects & Works
    /$projectId                     Milestones, cost split, custom fields
  /subscriptions                    SaaS client subscriptions
  /notifications                    Full notification history
  /settings
    /profile                        Self profile + Gmail connect/disconnect
    /users                          Admin: add/edit/remove users, set page access, generate password
    /access                         Admin: module access matrix
    /fields                         Custom fields per module (CRM, outreach, projects, subscriptions)
    /outreach                       Outreach dropdowns: status, lead status
    /projects                       Default milestones library
```

## Data Model (Supabase tables)

- `profiles` (id→auth.users, full_name, job_title, avatar_url, active)
- `module_access` (user_id, module enum, can_view, can_edit) — drives nav + RLS
- `activity_log` (id, actor_id, module, entity_type, entity_id, verb, summary, metadata, created_at) — powers feed
- `notifications` (id, user_id, type, title, body, link, read_at, created_at)
- CRM: `organisations`, `contacts` (org_id, fields jsonb)
- Outreach: `campaigns`, `campaign_contacts` (status_codes, dates jsonb, lead_status, notes, custom jsonb), `email_templates`, `campaign_templates` (m2m), `outreach_status_options`, `lead_status_options`
- Social: `social_plans` (platform, copy, media_path, scheduled_at, approval_status, post_status, assignee_id)
- Projects: `projects` (type: project|work, title, description, total_cost, business_cost, supplier_cost, status, priority, client_org_id, team_lead_id, start_date, end_date, custom jsonb), `milestones` (project_id, label, due_date, completed_at, is_custom), `milestone_templates`
- Subscriptions: `subscriptions` (client_org_id, plan, cost, billing_cycle, renewal_date, status, custom jsonb)
- Custom fields: `custom_field_defs` (module, key, label, type: text|dropdown|checklist, options jsonb)
- Assignments: `assignments` (entity_type, entity_id, user_id) — generic per-item assignment
- Gmail: `gmail_connections` (user_id, access_token, refresh_token, expiry, email) — tokens encrypted at rest
- Storage buckets: `avatars`, `social-media`, `project-files`

All tables: RLS on; SECURITY DEFINER `has_module_access(user_id, module)` function gates access; `service_role` grants for server fns.

## Key Behaviours

- **Auth**: email/password only, no public sign-up. Admins create users (temp password via built-in generator; user resets on first login). Forgot/reset password supported.
- **Module access**: nav items hidden + routes guarded based on `module_access`. Admin matrix UI.
- **Assignments**: each entity (contact, campaign, plan, project, subscription) can be assigned to one or more users.
- **Activity feed**: every mutation writes to `activity_log` via a single server-fn helper; dashboard shows latest 50 with filter chips.
- **Notifications**: triggers on assignment, mention, due-soon, milestone completion, post scheduled, renewal upcoming. In-app bell + Lovable Email digest/instant per user preference.
- **Calendar**: aggregates milestone due dates, scheduled social posts, subscription renewals, custom events; month/week views; click-through to entity.
- **Custom fields**: rendered dynamically on detail pages; defs editable in Settings → Fields per module.
- **Outreach contacts**: bulk Excel import (sheetjs) with column mapping + CSV export.
- **Email outreach send**: composes with template, sends via user's Gmail OAuth token (server fn refreshes token), records `first/second/third email` checkbox + date automatically on send.
- **Templates**: approval flag, many-to-many link to campaigns, variable substitution (`{{first_name}}` etc.).
- **Project costs**: total = business + supplier; validation + summary widget.
- **Milestones**: pre-seeded from `milestone_templates`; per-project custom milestones supported; completing one stamps `completed_at` automatically.
- **First admin**: I'll seed via SQL — send me your email after build mode starts.

## Technical Notes

- Server fns in `src/lib/<module>.functions.ts`, server-only helpers in `*.server.ts`
- Auth-protected fns use `requireSupabaseAuth`; admin ops use `supabaseAdmin` after role check
- Gmail OAuth: requires `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` secrets and a `/api/public/gmail/callback` route. I'll prompt for these once Cloud is enabled.
- Roles: `app_role` enum (`admin`, `member`) in `user_roles` table; admin role required for Settings → Users/Access/Fields.
- pgvector not needed; standard Postgres only.

## Build Order

1. Enable Cloud, scaffold design system (greens/greys tokens), sidebar shell, auth + protected layout, role/access infra
2. Settings → Users + Access matrix + custom field defs + seed admin
3. CRM (contacts/orgs) + activity log + notifications infra
4. Email Outreach (campaigns, templates, contacts table, import/export) — then Gmail OAuth + send
5. Social Planner
6. Projects & Works (with milestones + cost split)
7. Subscriptions
8. Dashboard feed + Calendar + Notifications page + bell
9. Polish: empty states, loading, responsive, logo

## Open Items

- Need the IO-Gen logo file (please attach in next message)
- Your email for the seeded first admin
- Google Cloud OAuth client ID/secret for Gmail (I'll guide setup when we reach that step)
