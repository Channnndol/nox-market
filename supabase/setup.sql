-- Run once in a NEW Supabase project's SQL editor. Public browsing requires no account.
create table if not exists public.nox_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) <= 300),
  kind text not null check (kind in ('drawing','watch','alert','preference','event','agent')),
  payload jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  revision bigint not null default 0,
  modified_at timestamptz not null default now(),
  primary key (user_id,id)
);
alter table public.nox_items enable row level security;
drop policy if exists own_rows on public.nox_items;
create policy own_rows on public.nox_items for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.nox_items from anon, authenticated;
grant select on public.nox_items to authenticated;

create or replace function public.nox_write(item_id text,item_kind text,item_payload jsonb,item_deleted boolean,expected_revision bigint)
returns public.nox_items language plpgsql security definer set search_path = '' as $$
declare who uuid := auth.uid(); current_row public.nox_items; result public.nox_items;
begin
  if who is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(item_id)>300 or octet_length(item_payload::text)>200000 then raise exception 'Item too large'; end if;
  insert into public.nox_items(user_id,id,kind) values(who,item_id,item_kind) on conflict do nothing;
  select * into current_row from public.nox_items where user_id=who and id=item_id for update;
  if current_row.revision <> expected_revision then raise exception 'Revision conflict' using errcode='PT409'; end if;
  update public.nox_items set kind=item_kind,payload=item_payload,deleted=item_deleted,revision=revision+1,modified_at=now()
    where user_id=who and id=item_id returning * into result;
  return result;
end $$;
revoke all on function public.nox_write(text,text,jsonb,boolean,bigint) from public,anon;
grant execute on function public.nox_write(text,text,jsonb,boolean,bigint) to authenticated;

-- Claim an alert AND record delivery intent in one transaction. Multiple PCs cannot both send it.
create or replace function public.nox_claim_alert(alert_id text,expected_revision bigint,event_id text,event_payload jsonb)
returns public.nox_items language plpgsql security definer set search_path = '' as $$
declare who uuid:=auth.uid(); a public.nox_items; result public.nox_items;
begin
  if who is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if length(event_id)>300 or octet_length(event_payload::text)>200000 then raise exception 'Item too large'; end if;
  select * into a from public.nox_items where user_id=who and id=alert_id for update;
  if not found or a.revision<>expected_revision or a.kind<>'alert' or a.deleted or not coalesce((a.payload->>'enabled')::boolean,false) then
    raise exception 'Alert already claimed or changed' using errcode='PT409';
  end if;
  update public.nox_items set payload=payload || jsonb_build_object('enabled',false,'lastFiredAt',extract(epoch from now())*1000),revision=revision+1,modified_at=now() where user_id=who and id=alert_id;
  insert into public.nox_items(user_id,id,kind,payload,revision) values(who,event_id,'event',event_payload,1) returning * into result;
  return result;
end $$;
revoke all on function public.nox_claim_alert(text,bigint,text,jsonb) from public,anon;
grant execute on function public.nox_claim_alert(text,bigint,text,jsonb) to authenticated;
