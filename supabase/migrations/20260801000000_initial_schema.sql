-- HomeKind initial schema (P1 — database package).
--
-- Purpose: households own devices (appliances, electronics, etc.) with attached
-- manuals/receipts and warranty tracking. Households are multi-member: every
-- member can read/write devices, rooms and documents, but only the owner
-- manages membership (invites, role changes are out of scope for M1, removal).
--
-- ADDITIVE-ONLY DISCIPLINE: this migration, and every migration that follows it,
-- must only ADD tables/columns/policies/functions. Do not drop or rename
-- existing columns/tables, do not narrow types, do not change a column from
-- nullable to not-null against existing data, etc. Destructive changes require
-- explicit review and a separate, deliberate migration. This discipline is what
-- keeps a Vercel instant rollback safe: an old deploy must still be able to talk
-- to the new schema. (House rule, see WattKind engineering practice.)

create extension if not exists "pgcrypto";

-- === Households (tenant root) ===============================================

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Full comment (including the no-insert-policy note) is applied after RLS is
-- enabled below, once that constraint actually exists.

-- === Household members ========================================================

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  warranty_threshold_days int not null default 30 check (warranty_threshold_days in (30, 60, 90)),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
comment on table household_members is 'Membership + per-member warranty notification lead time. All members read/write household data; only the owner manages membership.';
comment on column household_members.warranty_threshold_days is 'How many days before warranty_end this member wants to be notified.';

-- === Invites ===================================================================

create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table invites is 'Household invite tokens. Only the hash is stored; acceptance is performed by the service role, which resolves the raw token to this row.';

-- === Rooms =====================================================================

create table rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);
comment on table rooms is 'Optional grouping of devices within a household (e.g. Kitchen, Garage).';

-- === Devices ===================================================================

create table devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  name text not null,
  brand text,
  model_number text,
  purchase_date date,
  purchase_price numeric(10, 2),
  warranty_end date,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table devices is 'A tracked appliance/electronic item. deleted_at is a soft-delete marker; rows are retained for document history.';
comment on column devices.deleted_at is 'Soft delete: non-null means the device is retired from active lists but its documents are preserved.';

-- === Documents (manuals / receipts) ===========================================

create table documents (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  type text not null check (type in ('manual', 'receipt', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  page_count int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table documents is 'Metadata for a file stored in the device-documents Storage bucket. household_id is denormalized from devices for direct RLS scoping.';

-- === Push subscriptions ========================================================

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
comment on table push_subscriptions is 'Web Push subscription for a (user, household) pair, used to deliver warranty notifications.';

-- === Warranty notifications ====================================================

create table warranty_notifications (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'banner')),
  warranty_end date not null,
  notified_at timestamptz not null default now(),
  unique (device_id, channel, warranty_end, user_id)
);
comment on table warranty_notifications is 'Records a warranty-expiry notification already sent, so it is not repeated.';
comment on column warranty_notifications.warranty_end is 'Included in the uniqueness key so that editing a device''s warranty_end re-arms notifications for the new date.';

-- === AI usage ===================================================================

create table ai_usage (
  id bigint generated always as identity primary key,
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid,
  purpose text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  ts timestamptz not null default now()
);
-- Full comment (including the no-write-policy note) is applied after RLS is
-- enabled below.

-- === Indexes ====================================================================

create index idx_devices_household_active on devices (household_id) where deleted_at is null;
create index idx_devices_warranty_end on devices (warranty_end) where warranty_end is not null and deleted_at is null;
create index idx_documents_device on documents (device_id);
create index idx_household_members_user on household_members (user_id);
create index idx_invites_household on invites (household_id);
create index idx_ai_usage_household_ts on ai_usage (household_id, ts);

-- === updated_at trigger for devices ============================================

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
comment on function public.set_updated_at() is 'Generic BEFORE UPDATE trigger function that stamps updated_at = now().';

create trigger devices_set_updated_at
  before update on devices
  for each row execute function public.set_updated_at();

-- === RLS helper =================================================================

create function public.current_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from household_members where user_id = auth.uid()
$$;
comment on function public.current_household_ids() is
  'Returns the household ids the current auth.uid() belongs to. SECURITY DEFINER so it bypasses RLS internally (it reads household_members directly) -- this is what makes the household_members_own_household policy non-recursive: without it, a policy on household_members that queried household_members would recurse into itself. Policies must ONLY use this function for membership lookups, never query household_members directly from another table''s policy.';

revoke all on function public.current_household_ids() from public;
revoke all on function public.current_household_ids() from anon;
grant execute on function public.current_household_ids() to authenticated;

-- === Row Level Security =========================================================

alter table households enable row level security;

comment on table households is 'Tenant root. One household = one home; owner_id is the creating user. No insert policy: households are created exclusively via the create_household_with_defaults RPC (SECURITY DEFINER) so creation cannot race RLS.';

create policy households_own_household on households for select
  to authenticated
  using (id in (select public.current_household_ids()));

create policy households_own_household_update on households for update
  to authenticated
  using (owner_id = auth.uid());

create policy households_own_household_delete on households for delete
  to authenticated
  using (owner_id = auth.uid());

alter table household_members enable row level security;

create policy household_members_own_household on household_members for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

-- A member may remove themself, or the household owner may remove any member
-- other than themself (owner leaves by deleting the household, not by removing
-- their own membership row).
create policy household_members_own_household_delete on household_members for delete
  to authenticated
  using (
    (user_id = auth.uid())
    or (
      exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
      and user_id <> auth.uid()
    )
  );

-- Update is limited in practice to warranty_threshold_days; a member may only
-- ever touch their own row, and cannot use the update to reassign it.
create policy household_members_own_household_update on household_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No insert policy: membership rows are created by the create_household_with_defaults
-- RPC (owner) or by service-role invite acceptance -- never a direct client insert.

alter table invites enable row level security;

create policy invites_own_household on invites for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy invites_own_household_insert on invites for insert
  to authenticated
  with check (household_id in (select public.current_household_ids()) and created_by = auth.uid());

-- Delete allows any member to revoke an outstanding invite.
create policy invites_own_household_delete on invites for delete
  to authenticated
  using (household_id in (select public.current_household_ids()));

-- No select-by-token policy for anon: an unauthenticated invitee cannot look up
-- an invite row directly. Invite acceptance (resolving token -> household,
-- inserting the membership row) is performed exclusively by the service role.

alter table rooms enable row level security;
create policy rooms_own_household on rooms for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

alter table devices enable row level security;
create policy devices_own_household on devices for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

alter table documents enable row level security;
create policy documents_own_household on documents for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

alter table push_subscriptions enable row level security;
create policy push_subscriptions_own_household on push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id in (select public.current_household_ids()));

alter table warranty_notifications enable row level security;
create policy warranty_notifications_own_household on warranty_notifications for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

alter table ai_usage enable row level security;

comment on table ai_usage is 'Per-call AI token usage, scoped to a household, for cost tracking/budgeting. No insert/update/delete policy: written by the service role only.';

create policy ai_usage_own_household on ai_usage for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

-- === Onboarding RPC ==============================================================

-- SECURITY DEFINER: households has no insert policy (see comment above), so
-- creating a household + owner membership + default rooms must happen
-- atomically inside a definer function rather than as three separate client
-- inserts racing RLS.
create function public.create_household_with_defaults(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if trim(p_name) = '' or length(p_name) > 80 then
    raise exception 'invalid_household_name';
  end if;

  insert into households (name, owner_id)
  values (trim(p_name), auth.uid())
  returning id into v_household_id;

  insert into household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'owner');

  insert into rooms (household_id, name)
  values
    (v_household_id, 'Kitchen'),
    (v_household_id, 'Living Room'),
    (v_household_id, 'Laundry'),
    (v_household_id, 'Garage');

  return v_household_id;
end;
$$;
comment on function public.create_household_with_defaults(text) is
  'Atomic onboarding: creates a household, its owner membership row, and four default rooms. SECURITY DEFINER because households has no insert policy for direct client inserts -- this RPC is the only path to creating a household, avoiding a race against RLS across the three inserts.';

revoke all on function public.create_household_with_defaults(text) from public;
revoke all on function public.create_household_with_defaults(text) from anon;
grant execute on function public.create_household_with_defaults(text) to authenticated;
