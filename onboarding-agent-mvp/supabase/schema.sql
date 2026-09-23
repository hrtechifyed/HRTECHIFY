-- Onboard AI SaaS schema
-- Run in a DEDICATED Supabase project for this product.
-- Public tables use RLS; privileged helpers live in a non-exposed schema.

create extension if not exists pgcrypto;
create schema if not exists app_private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text,
  tone text default 'Warm & professional',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','employee')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
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
  unique (organization_id, email)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  category text default 'General',
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  due_offset_days integer default 0,
  status text not null default 'open' check (status in ('open','completed','skipped')),
  source text default 'default',
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

create index if not exists memberships_user_idx on public.memberships(user_id, organization_id);
create index if not exists employees_org_status_idx on public.employees(organization_id, status);
create index if not exists documents_org_idx on public.documents(organization_id);
create index if not exists chunks_org_doc_idx on public.knowledge_chunks(organization_id, document_id);
create index if not exists tasks_employee_idx on public.onboarding_tasks(employee_id, status);
create index if not exists messages_employee_idx on public.agent_messages(employee_id, created_at);

-- Secure helper functions: auth.uid() is checked inside every authorization helper.
create or replace function app_private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m
    where m.organization_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function app_private.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m
    where m.organization_id = target_org and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

revoke all on function app_private.is_org_member(uuid) from public;
revoke all on function app_private.is_org_admin(uuid) from public;
grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.is_org_admin(uuid) to authenticated;

-- Bootstrap admin membership + subscription after company creation.
create or replace function app_private.bootstrap_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.memberships(organization_id,user_id,role) values (new.id,new.created_by,'admin');
  insert into public.subscriptions(organization_id) values (new.id);
  return new;
end;
$$;
revoke all on function app_private.bootstrap_organization() from public;

drop trigger if exists organizations_bootstrap on public.organizations;
create trigger organizations_bootstrap after insert on public.organizations
for each row execute function app_private.bootstrap_organization();

-- Create a generic onboarding journey for every employee.
create or replace function app_private.bootstrap_employee_tasks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.onboarding_tasks(organization_id,employee_id,title,description,due_offset_days,source) values
    (new.organization_id,new.id,'Meet your manager','Have your first manager conversation and align on immediate priorities.',0,'default'),
    (new.organization_id,new.id,'Confirm IT and system access','Check that your laptop, core systems, email and required access are working.',0,'default'),
    (new.organization_id,new.id,'Understand your team','Learn the team purpose, structure, key roles and ways of working.',3,'default'),
    (new.organization_id,new.id,'Review essential policies','Review the policies and processes most relevant to your role and location.',5,'default'),
    (new.organization_id,new.id,'Meet key stakeholders','Identify and connect with the people you will work with most often.',10,'default'),
    (new.organization_id,new.id,'Discuss role expectations','Align with your manager on outcomes, priorities and what good performance looks like.',14,'default'),
    (new.organization_id,new.id,'Complete 30-day check-in','Reflect on progress, remaining questions and support needed for the next phase.',30,'default');
  return new;
end;
$$;
revoke all on function app_private.bootstrap_employee_tasks() from public;

drop trigger if exists employees_bootstrap_tasks on public.employees;
create trigger employees_bootstrap_tasks after insert on public.employees
for each row execute function app_private.bootstrap_employee_tasks();

-- Database-enforced active-seat limit. The client cannot bypass the monetization gate.
create or replace function app_private.enforce_active_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_seats integer;
  used_seats integer;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;

  select coalesce(included_seats,3) + coalesce(paid_seats,0)
  into allowed_seats from public.subscriptions where organization_id = new.organization_id;
  allowed_seats := coalesce(allowed_seats,3);

  select count(*) into used_seats
  from public.employees
  where organization_id = new.organization_id and status = 'active'
    and (tg_op = 'INSERT' or id <> new.id);

  if used_seats >= allowed_seats then
    raise exception 'SEAT_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function app_private.enforce_active_seat_limit() from public;

drop trigger if exists employees_seat_limit on public.employees;
create trigger employees_seat_limit before insert or update of status on public.employees
for each row execute function app_private.enforce_active_seat_limit();

-- Employee self-claim by the authenticated email address.
-- Privileged work stays in app_private; the exposed public RPC is security-invoker only.
create or replace function app_private.claim_pending_employee_impl()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_emp public.employees%rowtype;
begin
  if v_uid is null or v_email = '' then return null; end if;
  select * into v_emp from public.employees
  where lower(email)=v_email and auth_user_id is null
  order by created_at asc limit 1;
  if not found then return null; end if;

  update public.employees set auth_user_id=v_uid where id=v_emp.id;
  insert into public.memberships(organization_id,user_id,role)
  values(v_emp.organization_id,v_uid,'employee') on conflict do nothing;
  return v_emp.organization_id;
end;
$$;
revoke all on function app_private.claim_pending_employee_impl() from public;
grant execute on function app_private.claim_pending_employee_impl() to authenticated;

create or replace function public.claim_pending_employee()
returns uuid
language sql
security invoker
set search_path = public, pg_temp
as $$
  select app_private.claim_pending_employee_impl();
$$;
revoke all on function public.claim_pending_employee() from public;
grant execute on function public.claim_pending_employee() to authenticated;

-- RLS
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.employees enable row level security;
alter table public.documents enable row level security;
alter table public.knowlede_chunks enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.agent_messages enable row level security;

grant select,insert,update,delete on public.organizations,public.memberships,public.subscriptions,public.employees,public.documents,public.knowledge_chunks,public.onboarding_tasks,public.agent_messages to authenticated;

create policy org_select on public.organizations for select to authenticated using (app_private.is_org_member(id));
create policy org_insert on public.organizations for insert to authenticated with check (created_by = (select auth.uid()));
create policy org_update on public.organizations for update to authenticated using (app_private.is_org_admin(id)) with check (app_private.is_org_admin(id));

create policy membership_select on public.memberships for select to authenticated using (user_id=(select auth.uid()) or app_private.is_org_admin(organization_id));
create policy membership_insert_admin on public.memberships for insert to authenticated with check (app_private.is_org_admin(organization_id));
create policy membership_delete_admin on public.memberships for delete to authenticated using (app_private.is_org_admin(organization_id));

create policy subscription_select_admin on public.subscriptions for select to authenticated using (app_private.is_org_admin(organization_id));
-- No client update policy: bill[™Èİ]HÚİ[™HÚ[™ÙYÛ›HH\İYÙ\™\‹ÑYÙH[˜İ[ÛˆÛÙK‚‚˜Ü™X]HÛXŞH[\ŞYYWÜÙ[XİÛˆX›XË™[\ŞYY\È›ÜˆÙ[XİÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
HÜˆ]]İ\Ù\—ÚYJÙ[Xİ]]ZY

JJNÂ˜Ü™X]HÛXŞH[\ŞYYWÚ[œÙ\ØYZ[ˆÛˆX›XË™[\ŞYY\È›Üˆ[œÙ\È]][XØ]YÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ˜Ü™X]HÛXŞH[\ŞYYWİ\]WØYZ[ˆÛˆX›XË™[\ŞYY\È›Üˆ\]HÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JHÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ˜Ü™X]HÛXŞH[\ŞYYWÙ[]WØYZ[ˆÛˆX›XË™[\ŞYY\È›Üˆ[]HÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ‚˜Ü™X]HÛXŞHØİ[Y[ÜÙ[XİÛˆX›XË™Øİ[Y[È›ÜˆÙ[XİÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ÛY[X™\ŠÜ™Ø[š^˜][Û—ÚY
JNÂ˜Ü™X]HÛXŞHØİ[Y[Ú[œÙ\ØYZ[ˆÛˆX›XË™Øİ[Y[È›Üˆ[œÙ\È]][XØ]YÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
H[™\ØYYØOJÙ[Xİ]]ZY

JJNÂ˜Ü™X]HÛXŞHØİ[Y[Ù[]WØYZ[ˆÛˆX›XË™Øİ[Y[È›Üˆ[]HÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ‚˜Ü™X]HÛXŞHÚ[š×ÜÙ[XİÛˆX›XËšÛ›İÛYÙWØÚ[šÜÈ›ÜˆÙ[XİÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ÛY[X™\ŠÜ™Ø[š^˜][Û—ÚY
JNÂ˜Ü™X]HÛXŞHÚ[š×Ú[œÙ\ØYZ[ˆÛˆX›XËšÛ›İÛYÙWØÚ[šÜÈ›Üˆ[œÙ\È]][XØ]YÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ˜Ü™X]HÛXŞHÚ[š×Ù[]WØYZ[ˆÛˆX›XËšÛ›İÛYÙWØÚ[šÜÈ›Üˆ[]HÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ‚˜Ü™X]HÛXŞH\Ú×ÜÙ[XİÛˆX›XË›Û˜›Ø\™[™×İ\ÚÜÈ›ÜˆÙ[XİÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
HÜˆ^\İÊÙ[XİHœ›ÛHX›XË™[\ŞYY\ÈHÚ\™HKšYY[\ŞYYWÚY[™K˜]]İ\Ù\—ÚYJÙ[Xİ]]ZY

JJJNÂ˜Ü™X]HÛXŞH\Ú×Ú[œÙ\ØYZ[ˆÛˆX›XË›Û˜›Ø\™[™×İ\ÚÜÈ›Üˆ[œÙ\È]][XØ]YÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
JNÂ˜Ü™X]HÛXŞH\Ú×İ\]WÛY[X™\ˆÛˆX›XË›Û˜›Ø\™[™×İ\ÚÜÈ›Üˆ\]HÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
HÜˆ^\İÊÙ[XİHœ›ÛHX›XË™[\ŞYY\ÈHÚ\™HKšYY[\ŞYYWÚY[™K˜]]İ\Ù\—ÚYJÙ[Xİ]]ZY

JJJBÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
HÜˆ^\İÊÙ[XİHœ›ÛHX›XË™[\ŞYY\ÈHÚ\™HKšYY[\ŞYYWÚY[™K˜]]İ\Ù\—ÚYJÙ[Xİ]]ZY

JJJNÂ‚˜Ü™X]HÛXŞHY\ÜØYÙWÜÙ[XİÛˆX›XË˜YÙ[ÛY\ÜØYÙ\È›ÜˆÙ[XİÈ]][XØ]Y\Ú[™È
\Üš]˜]Kš\×ÛÜ™×ØYZ[ŠÜ™Ø[š^˜][Û—ÚY
HÜˆ\Ù\—ÚYJÙ[Xİ]]ZY

JJNÂ˜Ü™X]HÛXŞHY\ÜØYÙWÚ[œÙ\ÛˆX›XË˜YÙ[ÛY\ÜØYÙ\È›Üˆ[œÙ\È]][XØ]YÚ]ÚXÚÈ
\Üš]˜]Kš\×ÛÜ™×ÛY[X™\ŠÜ™Ø[š^˜][Û—ÚY
H[™\Ù\—ÚYJÙ[Xİ]]ZY

JJNÂ‚‹KHš]˜]HØİ[Y[XÚÙ][™]X˜\ÙY[˜[ÛÛ›ÛË‚š[œÙ\[ÈİÜ˜YÙK˜XÚÙ]ÊY˜[YKX›XÊH˜[Y\È
	ØÛÛ\[KZÛ›İÛYÙIË	ØÛÛ\[KZÛ›İÛYÙIË˜[ÙJB›ÛˆÛÛ™›Xİ
Y
HÈ\]HÙ]X›XÏY˜[ÙNÂ‚˜Ü™X]HÛXŞHÛÛ\[WÚÛ›İÛYÙWÜ™XYÛˆİÜ˜YÙK›Øš™XİÈ›ÜˆÙ[XİÈ]][XØ]Y\Ú[™È
XÚÙ]ÚYIØÛÛ\[KZÛ›İÛYÙIÈ[™\Üš]˜]Kš\×ÛÜ™×ÛY[X™\Š
İÜ˜YÙK™›Û\›˜[YJ˜[YJJVÌWN]ZY
JNÂ˜Ü™X]HÛXŞHÛÛ\[WÚÛ›İÛYÙWÚ[œÙ\ÛˆİÜ˜YÙK›Øš™XİÈ›Üˆ[œÙ\È]][XØ]YÚ]ÚXÚÈ
XÚÙ]ÚYIØÛÛ\[KZÛ›İÛYÙIÈ[™\Üš]˜]Kš\×ÛÜ™×ØYZ[Š
İÜ˜YÙK™›Û\›˜[YJ˜[YJJVÌWN]ZY
JNÂ˜Ü™X]HÛXŞHÛÛ\[WÚÛ›İÛYÙWİ\]HÛˆİÜ˜YÙK›Øš™XİÈ›Üˆ\]HÈ]][XØ]Y\Ú[™È
XÚÙ]ÚYIØÛÛ\[KZÛ›İÛYÙIÈ[™\Üš]˜]Kš\×ÛÜ™×ØYZ[Š
İÜ˜YÙK™›Û\›˜[YJ˜[YJJVÌWN]ZY
JBÚ]ÚXÚÈ
XÚÙ]ÚYIØÛÛ\[KZÛ›İÛYÙIÈ[™\Üš]˜]Kš\×ÛÜ™×ØYZ[Š
İÜ˜YÙK™›Û\›˜[YJ˜[YJJVÌWN]ZY
JNÂ˜Ü™X]HÛXŞHÛÛ\[WÚÛ›İÛYÙWÙ[]HÛˆİÜ˜YÙK›Øš™XİÈ›Üˆ[]HÈ]][XØ]Y\Ú[™È
XÚÙ]ÚYIØÛÛ\[KZÛ›İÛYÙIÈ[™\Üš]˜]Kš\×ÛÜ™×ØYZ[Š
İÜ˜YÙK™›Û\›˜[YJ˜[YJJVÌWN]ZY
JNÂ