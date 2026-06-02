# Multi-Tenancy Plan: Organisation-Scoped App

Make the app fully tenant-isolated. Every record belongs to one organisation; users only ever see data from organisations they're explicitly assigned to. A new **Super Admin** role manages organisations and assigns users.

> Important distinction: the existing `organisations` table is a **CRM record** (your clients/companies you track). This plan introduces a separate concept — **tenants** — which represent *your* customer organisations who use the app. To avoid confusion I'll name the new table `tenants` (label it "Organisation" in the UI). If you'd rather rename the CRM `organisations` table to `companies` or `accounts` instead and reuse the name `organisations` for tenants, tell me and I'll adjust.

## 1. Data Model

**New tables**

- `tenants` — id, name, slug, logo_url, active, created_at
- `tenant_members` — tenant_id, user_id, role (`owner` | `member`), created_at, unique(tenant_id, user_id)
- Add `'super_admin'` to the `app_role` enum (alongside existing `admin`)

**Add `tenant_id uuid NOT NULL` to every tenant-owned table:**

- contacts, organisations (CRM), projects, subscriptions, campaigns, campaign_contacts, campaign_templates, email_templates, social_plans, events, milestones, cost_versions, milestone_templates, custom_field_defs, builtin_field_labels, subscription_plan_options, lead_status_options, outreach_status_options, activity_log, notifications, assignments, gmail_connections
- Index on `tenant_id` for each table
- `cost_items` inherits tenant via parent `cost_versions` (no direct column needed)

**Active tenant context**

- Add `active_tenant_id` to `profiles` (last selected tenant)
- New helper functions:
  - `is_super_admin(uid)` 
  - `current_tenant_id()` — reads from `profiles.active_tenant_id`, validates membership
  - `has_tenant_access(uid, tenant_id)` — true if super_admin OR member
  - Update `has_module_access` / `can_edit_module` to also require tenant membership

## 2. RLS Rewrite

Every tenant-scoped table's policies become:

```
USING (tenant_id = current_tenant_id() AND has_module_access(auth.uid(), '<module>'))
WITH CHECK (tenant_id = current_tenant_id() AND can_edit_module(...))
```

Super admins bypass via `is_super_admin(auth.uid()) OR (...)`.

`module_access` stays per-user (a user can have different module permissions per tenant — add `tenant_id` here too).

## 3. Super Admin Role

- New role `super_admin` stored in `user_roles`
- Capabilities:
  - Create/edit/delete tenants
  - Assign any user to any tenant (as owner or member)
  - Switch into any tenant's context to view/manage data
  - Manage global settings (custom fields, milestones, plans templates — decide if these are global or per-tenant; recommend **per-tenant** for true isolation)
- Regular **admin** role becomes scoped to a single tenant (tenant admin)

## 4. UI Changes

**Tenant switcher** (top of sidebar)

- Dropdown showing tenants the user belongs to
- Selecting one calls server fn that updates `profiles.active_tenant_id` and invalidates all queries
- Single-tenant users see static label, no dropdown

**New Settings sections** (super admin only)

- `/settings/tenants` — list, create, edit, deactivate tenants
- `/settings/tenants/$id/members` — assign users, set tenant role + module access per tenant

**Updated Settings sections**

- `/settings/users` — split into: "All users" (super admin) and "This organisation's members" (tenant admin)
- Module access editor moves under tenant context

**Onboarding flow**

- First-run migration creates a default tenant ("Default Organisation"), assigns all existing data/users to it, promotes first admin to super_admin
- New user signup: must be invited into a tenant by super_admin or tenant owner

## 5. Server Functions / Code

- All `createServerFn` handlers using `requireSupabaseAuth` get a new helper `requireTenant` that resolves and validates `current_tenant_id`
- All Supabase queries in components remove manual filters — RLS handles isolation
- `AuthProvider` extended: `activeTenantId`, `tenants[]`, `switchTenant(id)`, `isSuperAdmin`
- Dashboard/reporting queries automatically scoped; super admin gets optional "All tenants" aggregate view

## 6. Migration Strategy

Single migration that:

1. Creates `tenants`, `tenant_members`, adds enum value
2. Inserts default tenant, backfills `tenant_id` on every table
3. Adds NOT NULL + FK constraints after backfill
4. Inserts `tenant_members` rows for all existing users
5. Promotes existing admins to super_admin (or asks you which user)
6. Replaces all RLS policies
7. Adds `active_tenant_id` to profiles, sets to default tenant

## 7. Future-Proofing

- Per-tenant branding (logo, name in header)
- Per-tenant subdomain support (optional, e.g. `acme.app.com`) — schema ready, routing later
- Per-tenant feature flags / plan tiers
- Tenant-level usage metrics for super admin
- Soft delete / archive tenants instead of hard delete
- Export/import tenant data (GDPR-friendly)

## Technical Notes

- Storage buckets (`avatars`, `social-media`, `project-files`) get path prefix `{tenant_id}/...` with storage policies enforcing the prefix
- Realtime channels become `tenant:{id}:...` scoped
- Activity log + notifications carry tenant_id; cross-tenant leakage impossible
- `cost_items` security inherited via join on `cost_versions.tenant_id`

## Open Questions

1. **Naming**: keep CRM table as `organisations` and call tenants `tenants` (UI: "Organisations"), or rename CRM → `companies`/`accounts` and use `organisations` for tenants? Yes
2. **Global vs per-tenant settings**: should custom field definitions, milestone templates, plan options, and built-in label overrides be **per-tenant** (true isolation, recommended) or **global** (super admin manages once)? Yes per-tenant
3. **Initial super admin**: which existing user should be promoted? (or create a new one) jed@io-gen.com
4. **Default tenant name** for backfilling existing data? IO-Gen
5. Should super admins viewing a tenant's data trigger an audit log entry? Yes

Answer these and I'll implement in build mode.