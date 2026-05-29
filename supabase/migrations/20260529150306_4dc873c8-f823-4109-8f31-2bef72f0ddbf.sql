
-- ENUMS
create type public.app_role as enum ('admin', 'member');
create type public.app_module as enum ('dashboard','crm','outreach','social','projects','subscriptions','calendar','settings');
create type public.priority_level as enum ('low','medium','high');
create type public.project_status as enum ('in_progress','on_hold','cancelled','completed');
create type public.project_type as enum ('project','work');
create type public.social_platform as enum ('linkedin','instagram','x','threads','facebook','tiktok','youtube');
create type public.approval_status as enum ('approved','not_approved');
create type public.post_status as enum ('posted','not_posted','cancelled');
create type public.subscription_status as enum ('active','paused','cancelled','past_due');
create type public.custom_field_type as enum ('text','number','date','dropdown','checklist','long_text');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  job_title text,
  avatar_url text,
  email text not null,
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- USER ROLES (separate table, never on profiles)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- MODULE ACCESS
create table public.module_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module app_module not null,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  unique (user_id, module)
);

-- SECURITY DEFINER helpers
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin')
$$;

create or replace function public.has_module_access(_user_id uuid, _module app_module)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(_user_id)
      or exists (select 1 from public.module_access where user_id = _user_id and module = _module and can_view)
$$;

create or replace function public.can_edit_module(_user_id uuid, _module app_module)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(_user_id)
      or exists (select 1 from public.module_access where user_id = _user_id and module = _module and can_edit)
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, job_title, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'job_title',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ACTIVITY LOG
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  module app_module not null,
  entity_type text not null,
  entity_id uuid,
  verb text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- CUSTOM FIELDS DEFS
create table public.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  module app_module not null,
  key text not null,
  label text not null,
  type custom_field_type not null,
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (module, key)
);

-- ASSIGNMENTS (generic)
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, user_id)
);
create index assignments_entity_idx on public.assignments (entity_type, entity_id);
create index assignments_user_idx on public.assignments (user_id);

-- CRM: ORGANISATIONS
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  website text,
  notes text,
  custom jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

-- CRM: CONTACTS
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  job_title text,
  organisation_id uuid references public.organisations(id) on delete set null,
  is_lead boolean not null default false,
  notes text,
  custom jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- OUTREACH dropdowns config (configurable)
create table public.outreach_status_options (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  position int not null default 0
);

create table public.lead_status_options (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  is_default boolean not null default false,
  position int not null default 0
);

insert into public.outreach_status_options(key,label,position) values
  ('first_email','First email',1),
  ('second_email','Second email',2),
  ('third_email','Third email',3);

insert into public.lead_status_options(key,label,is_default,position) values
  ('no_reply','No reply',true,1),
  ('requested_meeting','Requested a meeting',false,2),
  ('not_interested','Not interested',false,3),
  ('converted','Converted',false,4);

-- OUTREACH: CAMPAIGNS
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- OUTREACH: CONTACTS within a campaign
create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  job_title text,
  organisation text,
  website text,
  industry text,
  -- outreach steps stored as jsonb: { first_email: {done:true,date:'...'}, ... }
  outreach jsonb not null default '{}'::jsonb,
  lead_status text not null default 'no_reply',
  notes text,
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaign_contacts_campaign_idx on public.campaign_contacts (campaign_id);
create trigger campaign_contacts_updated_at before update on public.campaign_contacts
  for each row execute function public.set_updated_at();

-- OUTREACH: EMAIL TEMPLATES
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  approved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

create table public.campaign_templates (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  primary key (campaign_id, template_id)
);

-- SOCIAL PLANNER
create table public.social_plans (
  id uuid primary key default gen_random_uuid(),
  platform social_platform not null,
  copy text not null default '',
  media_path text,
  scheduled_at timestamptz,
  approval_status approval_status not null default 'not_approved',
  post_status post_status not null default 'not_posted',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger social_plans_updated_at before update on public.social_plans
  for each row execute function public.set_updated_at();

-- PROJECTS & WORKS
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  type project_type not null default 'project',
  title text not null,
  description text,
  total_cost numeric(14,2) not null default 0,
  business_cost numeric(14,2) not null default 0,
  supplier_cost numeric(14,2) not null default 0,
  status project_status not null default 'in_progress',
  priority priority_level not null default 'medium',
  team_lead_id uuid references auth.users(id) on delete set null,
  client_org_id uuid references public.organisations(id) on delete set null,
  client_contact_id uuid references public.contacts(id) on delete set null,
  start_date date,
  end_date date,
  custom jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.milestone_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  position int not null default 0
);
insert into public.milestone_templates(label,position) values
  ('Initial enquiry',1),
  ('Cost proposal submitted',2),
  ('Order approved',3),
  ('Order received',4),
  ('Project completed',5),
  ('Project invoiced',6);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  due_date date,
  completed_at timestamptz,
  is_custom boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id, position);

-- SUBSCRIPTIONS
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_org_id uuid references public.organisations(id) on delete set null,
  client_contact_id uuid references public.contacts(id) on delete set null,
  plan_name text not null,
  cost numeric(14,2) not null default 0,
  billing_cycle text not null default 'monthly',
  renewal_date date,
  status subscription_status not null default 'active',
  custom jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- GMAIL CONNECTIONS (per user)
create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  expiry_ts timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gmail_connections_updated_at before update on public.gmail_connections
  for each row execute function public.set_updated_at();

-- ============= GRANTS =============
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select on public.module_access to authenticated;
grant all on public.module_access to service_role;

grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;

grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

grant select on public.custom_field_defs to authenticated;
grant all on public.custom_field_defs to service_role;

grant select, insert, update, delete on public.assignments to authenticated;
grant all on public.assignments to service_role;

grant select, insert, update, delete on public.organisations to authenticated;
grant all on public.organisations to service_role;

grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;

grant select on public.outreach_status_options to authenticated;
grant all on public.outreach_status_options to service_role;

grant select on public.lead_status_options to authenticated;
grant all on public.lead_status_options to service_role;

grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;

grant select, insert, update, delete on public.campaign_contacts to authenticated;
grant all on public.campaign_contacts to service_role;

grant select, insert, update, delete on public.email_templates to authenticated;
grant all on public.email_templates to service_role;

grant select, insert, update, delete on public.campaign_templates to authenticated;
grant all on public.campaign_templates to service_role;

grant select, insert, update, delete on public.social_plans to authenticated;
grant all on public.social_plans to service_role;

grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

grant select on public.milestone_templates to authenticated;
grant all on public.milestone_templates to service_role;

grant select, insert, update, delete on public.milestones to authenticated;
grant all on public.milestones to service_role;

grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

-- gmail tokens: server-only
grant all on public.gmail_connections to service_role;

-- ============= RLS =============
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.module_access enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications enable row level security;
alter table public.custom_field_defs enable row level security;
alter table public.assignments enable row level security;
alter table public.organisations enable row level security;
alter table public.contacts enable row level security;
alter table public.outreach_status_options enable row level security;
alter table public.lead_status_options enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.email_templates enable row level security;
alter table public.campaign_templates enable row level security;
alter table public.social_plans enable row level security;
alter table public.projects enable row level security;
alter table public.milestone_templates enable row level security;
alter table public.milestones enable row level security;
alter table public.subscriptions enable row level security;
alter table public.gmail_connections enable row level security;

-- profiles: everyone authenticated can read all profiles (collaboration); self update; admins write
create policy "profiles read all" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles admin all" on public.profiles for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- user_roles: read self + admin all
create policy "user_roles read self" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- module_access: self read + admin all
create policy "module_access self read" on public.module_access for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- activity_log: any authenticated user can read; insert any authenticated (server logs as actor)
create policy "activity_log read" on public.activity_log for select to authenticated using (true);
create policy "activity_log insert" on public.activity_log for insert to authenticated with check (actor_id = auth.uid());

-- notifications: own only
create policy "notifications own" on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- custom_field_defs: all read
create policy "cfd read" on public.custom_field_defs for select to authenticated using (true);

-- assignments: read all (so users can see who's assigned), insert/delete by authenticated
create policy "assignments read" on public.assignments for select to authenticated using (true);
create policy "assignments write" on public.assignments for insert to authenticated with check (true);
create policy "assignments delete" on public.assignments for delete to authenticated using (true);

-- Module-gated tables: view if module access; edit if can_edit
-- CRM
create policy "orgs view" on public.organisations for select to authenticated using (public.has_module_access(auth.uid(),'crm'));
create policy "orgs write" on public.organisations for insert to authenticated with check (public.can_edit_module(auth.uid(),'crm'));
create policy "orgs update" on public.organisations for update to authenticated using (public.can_edit_module(auth.uid(),'crm'));
create policy "orgs delete" on public.organisations for delete to authenticated using (public.can_edit_module(auth.uid(),'crm'));

create policy "contacts view" on public.contacts for select to authenticated using (public.has_module_access(auth.uid(),'crm'));
create policy "contacts write" on public.contacts for insert to authenticated with check (public.can_edit_module(auth.uid(),'crm'));
create policy "contacts update" on public.contacts for update to authenticated using (public.can_edit_module(auth.uid(),'crm'));
create policy "contacts delete" on public.contacts for delete to authenticated using (public.can_edit_module(auth.uid(),'crm'));

-- Outreach dropdowns: all authenticated read
create policy "oso read" on public.outreach_status_options for select to authenticated using (true);
create policy "lso read" on public.lead_status_options for select to authenticated using (true);

-- Outreach
create policy "campaigns view" on public.campaigns for select to authenticated using (public.has_module_access(auth.uid(),'outreach'));
create policy "campaigns write" on public.campaigns for insert to authenticated with check (public.can_edit_module(auth.uid(),'outreach'));
create policy "campaigns update" on public.campaigns for update to authenticated using (public.can_edit_module(auth.uid(),'outreach'));
create policy "campaigns delete" on public.campaigns for delete to authenticated using (public.can_edit_module(auth.uid(),'outreach'));

create policy "cc view" on public.campaign_contacts for select to authenticated using (public.has_module_access(auth.uid(),'outreach'));
create policy "cc write" on public.campaign_contacts for insert to authenticated with check (public.can_edit_module(auth.uid(),'outreach'));
create policy "cc update" on public.campaign_contacts for update to authenticated using (public.can_edit_module(auth.uid(),'outreach'));
create policy "cc delete" on public.campaign_contacts for delete to authenticated using (public.can_edit_module(auth.uid(),'outreach'));

create policy "et view" on public.email_templates for select to authenticated using (public.has_module_access(auth.uid(),'outreach'));
create policy "et write" on public.email_templates for insert to authenticated with check (public.can_edit_module(auth.uid(),'outreach'));
create policy "et update" on public.email_templates for update to authenticated using (public.can_edit_module(auth.uid(),'outreach'));
create policy "et delete" on public.email_templates for delete to authenticated using (public.can_edit_module(auth.uid(),'outreach'));

create policy "ct view" on public.campaign_templates for select to authenticated using (public.has_module_access(auth.uid(),'outreach'));
create policy "ct write" on public.campaign_templates for insert to authenticated with check (public.can_edit_module(auth.uid(),'outreach'));
create policy "ct delete" on public.campaign_templates for delete to authenticated using (public.can_edit_module(auth.uid(),'outreach'));

-- Social
create policy "social view" on public.social_plans for select to authenticated using (public.has_module_access(auth.uid(),'social'));
create policy "social write" on public.social_plans for insert to authenticated with check (public.can_edit_module(auth.uid(),'social'));
create policy "social update" on public.social_plans for update to authenticated using (public.can_edit_module(auth.uid(),'social'));
create policy "social delete" on public.social_plans for delete to authenticated using (public.can_edit_module(auth.uid(),'social'));

-- Projects
create policy "proj view" on public.projects for select to authenticated using (public.has_module_access(auth.uid(),'projects'));
create policy "proj write" on public.projects for insert to authenticated with check (public.can_edit_module(auth.uid(),'projects'));
create policy "proj update" on public.projects for update to authenticated using (public.can_edit_module(auth.uid(),'projects'));
create policy "proj delete" on public.projects for delete to authenticated using (public.can_edit_module(auth.uid(),'projects'));

create policy "mt read" on public.milestone_templates for select to authenticated using (true);

create policy "ms view" on public.milestones for select to authenticated using (public.has_module_access(auth.uid(),'projects'));
create policy "ms write" on public.milestones for insert to authenticated with check (public.can_edit_module(auth.uid(),'projects'));
create policy "ms update" on public.milestones for update to authenticated using (public.can_edit_module(auth.uid(),'projects'));
create policy "ms delete" on public.milestones for delete to authenticated using (public.can_edit_module(auth.uid(),'projects'));

-- Subscriptions
create policy "subs view" on public.subscriptions for select to authenticated using (public.has_module_access(auth.uid(),'subscriptions'));
create policy "subs write" on public.subscriptions for insert to authenticated with check (public.can_edit_module(auth.uid(),'subscriptions'));
create policy "subs update" on public.subscriptions for update to authenticated using (public.can_edit_module(auth.uid(),'subscriptions'));
create policy "subs delete" on public.subscriptions for delete to authenticated using (public.can_edit_module(auth.uid(),'subscriptions'));

-- gmail_connections: server-only access via service role; no policies needed for authenticated

-- log_activity helper
create or replace function public.log_activity(
  _module app_module, _entity_type text, _entity_id uuid, _verb text, _summary text, _metadata jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.activity_log(actor_id, module, entity_type, entity_id, verb, summary, metadata)
  values (auth.uid(), _module, _entity_type, _entity_id, _verb, _summary, _metadata);
$$;

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('avatars','avatars',true),
  ('social-media','social-media',true),
  ('project-files','project-files',false)
on conflict (id) do nothing;

-- Storage policies
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars auth write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars auth update" on storage.objects for update to authenticated using (bucket_id = 'avatars');

create policy "social public read" on storage.objects for select using (bucket_id = 'social-media');
create policy "social auth write" on storage.objects for insert to authenticated with check (bucket_id = 'social-media');
create policy "social auth update" on storage.objects for update to authenticated using (bucket_id = 'social-media');
create policy "social auth delete" on storage.objects for delete to authenticated using (bucket_id = 'social-media');

create policy "proj files auth read" on storage.objects for select to authenticated using (bucket_id = 'project-files');
create policy "proj files auth write" on storage.objects for insert to authenticated with check (bucket_id = 'project-files');
create policy "proj files auth update" on storage.objects for update to authenticated using (bucket_id = 'project-files');
create policy "proj files auth delete" on storage.objects for delete to authenticated using (bucket_id = 'project-files');
