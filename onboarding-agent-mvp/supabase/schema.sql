-- Onboard AI SaaS — multi-tenant Supabase schema
-- Use a DEDICATED project. All public data tables use RLS.

create extension if not exists pgcrypto;
create schema if not exists app_private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text,
  tone text not null default 'Warm & professional',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','employee')),
  created_at timestamptz not null default now(),
  unique (organization_id,user_id)
);

create table if not exists public.subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'free',
  included_seats integer not null default 3 check (included_seats >= 0),
  paid_seats integer not null default 0 check (paid_seats >= 0),
  status text not null default 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text not null,
  role_title text,
  team_name text,
  manager_name text,
  location text,
  joining_date date,
  status text not null default 'active' check (status in ('pending','active','archived')),
  created_at timestamptz not null default now(),
  unique (organization_id,email)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  category text not null default 'General',
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (document_id,chunk_index)
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  due_offset_days integer not null default 0,
  status text not null default 'open' check (status in ('open','completed','skipped')),
  source text not null default 'default',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memberships_user_idx on public.memberships(user_id,organization_id);
create index if not exists employees_org_status_idx on public.employees(organization_id,status);
create index if not exists documents_org_idx on public.documents(organization_id);
create index if not exists chunks_org_idx on public.knowledge_chunks(organization_id,document_id);
create index if not exists tasks_employee_idx on public.onboarding_tasks(employee_id,status);
create index if not exists messages_employee_idx on public.agent_messages(employee_id,created_at);

-- Authorization helpers stay outside the exposed public schema.
create or replace function app_private.is_member(org uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid()
  );
$$;

create or replace function app_private.is_admin(org uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.role='admin'
  );
$$;

revoke all on function app_private.is_member(uuid) from public;
revoke all on function app_private.is_admin(uuid) from public;
grant execute on function app_private.is_member(uuid), app_private.is_admin(uuid) to authenticated;

-- New company => creator becomes admin and receives 3 free active seats.
create or replace function app_private.bootstrap_org() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.memberships(organization_id,user_id,role) values(new.id,new.created_by,'admin');
  insert into public.subscriptions(organization_id) values(new.id);
  return new;
end; $$;
revoke all on function app_private.bootstrap_org() from public;
drop trigger if exists organizations_bootstrap on public.organizations;
create trigger organizations_bootstrap after insert on public.organizations
for each row execute function app_private.bootstrap_org();

-- New employee => generic onboarding journey.
create or replace function app_private.bootstrap_tasks() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.onboarding_tasks(organization_id,employee_id,title,description,due_offset_days) values
  (new.organization_id,new.id,'Meet your manager','Have your first manager conversation and align on immediate priorities.',0),
  (new.organization_id,new.id,'Confirm IT and system access','Check that your laptop, core systems, email and required access are working.',0),
  (new.organization_id,new.id,'Understand your team','Learn the team purpose, structure, key roles and ways of working.',3),
  (new.organization_id,new.id,'Review essential policies','Review policies and processes relevant to your role and location.',5),
  (new.organization_id,new.id,'Meet key stakeholders','Identify and connect with the people you will work with most often.',10),
  (new.organization_id,new.id,'Discuss role expectations','Align on outcomes, priorities and what good performance looks like.',14),
  (new.organization_id,new.id,'Complete 30-day check-in','Reflect on progress, remaining questions and support needed.',30);
  return new;
end; $$;
revoke all on function app_private.bootstrap_tasks() from public;
drop trigger if exists employees_bootstrap_tasks on public.employees;
create trigger employees_bootstrap_tasks after insert on public.employees
for each row execute function app_private.bootstrap_tasks();

-- Monetization gate: 4th active employee fails unless paid_seats > 0.
create or replace function app_private.enforce_seats() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed_count integer; used_count integer;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' then return new; end if;
  select coalesce(included_seats,3)+coalesce(paid_seats,0) into allowed_count
  from public.subscriptions where organization_id=new.organization_id;
  allowed_count := coalesce(allowed_count,3);
  select count(*) into used_count from public.employees
  where organization_id=new.organization_id and status='active'
    and (tg_op='INSERT' or id<>new.id);
  if used_count >= allowed_count then
    raise exception 'SEAT_LIMIT_REACHED' using errcode='P0001';
  end if;
  return new;
end; $$;
revoke all on function app_private.enforce_seats() from public;
drop trigger if exists employees_seat_limit on public.employees;
create trigger employees_seat_limit before insert or update of status on public.employees
for each row execute function app_private.enforce_seats();

-- Privileged employee self-claim logic is private. Public RPC is security-invoker only.
create or replace function app_private.claim_pending_impl() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); mail text:=lower(coalesce(auth.jwt()->>'email','')); emp public.employees%rowtype;
begin
  if uid is null or mail='' then return null; end if;
  select * into emp from public.employees
  where lower(email)=mail and auth_user_id is null order by created_at limit 1;
  if not found then return null; end if;
  update public.employees set auth_user_id=uid where id=emp.id;
  insert into public.memberships(organization_id,user_id,role)
  values(emp.organization_id,uid,'employee') on conflict do nothing;
  return emp.organization_id;
end; $$;
revoke all on function app_private.claim_pending_impl() from public;
grant execute on function app_private.claim_pending_impl() to authenticated;

create or replace function public.claim_pending_employee() returns uuid
language sql security invoker set search_path=public,pg_temp as $$
  select app_private.claim_pending_impl();
$$;
revoke all on function public.claim_pending_employee() from public;
grant execute on function public.claim_pending_employee() to authenticated;

-- RLS on every exposed table.
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.employees enable row level security;
alter table public.documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.agent_messages enable row level security;

grant select,insert,update,delete on public.organizations,public.memberships,public.subscriptions,public.employees,public.documents,public.knowledge_chunks,public.onboarding_tasks,public.agent_messages to authenticated;

create policy org_read on public.organizations for select to authenticated using (app_private.is_member(id));
create policy org_create on public.organizations for insert to authenticated with check (created_by=auth.uid());
create policy org_edit on public.organizations for update to authenticated using (app_private.is_admin(id)) with check (app_private.is_admin(id));

create policy membership_read on public.memberships for select to authenticated using (user_id=auth.uid() or app_private.is_admin(organization_id));
create policy membership_add on public.memberships for insert to authenticated with check (app_private.is_admin(organization_id));
create policy membership_remove on public.memberships for delete to authenticated using (app_private.is_admin(organization_id));

create policy subscription_read on public.subscriptions for select to authenticated using (app_private.is_admin(organization_id));
-- Intentionally no subscription write policy: only trusted server/Edge Function code may change paid seats.

create policy employee_read on public.employees for select to authenticated using (app_private.is_admin(organization_id) or auth_user_id=auth.uid());
create policy employee_add on public.employees for insert to authenticated with check (app_private.is_admin(organization_id));
create policy employee_edit on public.employees for update to authenticated using (app_private.is_admin(organization_id)) with check (app_private.is_admin(organization_id));
create policy employee_remove on public.employees for delete to authenticated using (app_private.is_admin(organization_id));

create policy document_read on public.documents for select to authenticated using (app_private.is_member(organization_id));
create policy document_add on public.documents for insert to authenticated with check (app_private.is_admin(organization_id) and uploaded_by=auth.uid());
create policy document_remove on public.documents for delete to authenticated using (app_private.is_admin(organization_id));

create policy chunk_read on public.knowledge_chunks for select to authenticated using (app_private.is_member(organization_id));
create policy chunk_add on public.knowledge_chunks for insert to authenticated with check (app_private.is_admin(organization_id));
create policy chunk_remove on public.knowledge_chunks for delete to authenticated using (app_private.is_admin(organization_id));

create policy task_read on public.onboarding_tasks for select to authenticated using (
  app_private.is_admin(organization_id) or exists(select 1 from public.employees e where e.id=employee_id and e.auth_user_id=auth.uid())
);
create policy task_add on public.onboarding_tasks for insert to authenticated with check (app_private.is_admin(organization_id));
create policy task_edit on public.onboarding_tasks for update to authenticated using (
  app_private.is_admin(organization_id) or exists(select 1 from public.employees e where e.id=employee_id and e.auth_user_id=auth.uid())
) with check (
  app_private.is_admin(organization_id) or exists(select 1 from public.employees e where e.id=employee_id and e.auth_user_id=auth.uid())
);

create policy message_read on public.agent_messages for select to authenticated using (app_private.is_admin(organization_id) or user_id=auth.uid());
create policy message_add on public.agent_messages for insert to authenticated with check (app_private.is_member(organization_id) and user_id=auth.uid());

-- Private company document storage. First path segment must be organization UUID.
insert into storage.buckets(id,name,public) values('company-knowledge','company-knowledge',false)
on conflict(id) do update set public=false;

create policy company_files_read on storage.objects for select to authenticated using (
  bucket_id='company-knowledge' and app_private.is_member((storage.foldername(name))[1]::uuid)
);
create policy company_files_add on storage.objects for insert to authenticated with check (
  bucket_id='company-knowledge' and app_private.is_admin((storage.foldername(name))[1]::uuid)
);
create policy company_files_edit on storage.objects for update to authenticated using (
  bucket_id='company-knowledge' and app_private.is_admin((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id='company-knowledge' and app_private.is_admin((storage.foldername(name))[1]::uuid)
);
create policy company_files_remove on storage.objects for delete to authenticated using (
  bucket_id='company-knowledge' and app_private.is_admin((storage.foldername(name))[1]::uuid)
);
