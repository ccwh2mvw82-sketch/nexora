-- ============================================================
-- GestAffaires - Migration Supabase (PostgreSQL)
-- Stack : Supabase Auth + Postgres + RLS
-- Rendu : site independant (les modules lisent leurs cles depuis
-- la table app_data). Tout est securise par RLS par compte.
--
-- EXECUTION :
--   1. Supabase Dashboard > SQL Editor > coller ce fichier > Run
--   2. Puis promouvoir le premier compte admin :
--        insert into admin_keys (code)
--        select encode(sha256('VOTRE_CODE'), 'hex');
--      (code a choisir ; ne JAMAIS le mettre dans config.js)
-- ============================================================

-- ---------- PROFILS (lie a auth.users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  login      text unique,
  role       text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);

-- Creation automatique du profil a l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, login)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.raw_user_meta_data ->> 'login')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- DONNEES PAR COMPTE (cles JSON des modules GW) ----------
create table if not exists public.app_data (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  key        text not null,
  payload    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

-- Upsert forces sur le compte connecte (ne jamais laisser passer un owner_id libre)
create or replace function public.upsert_app_data(p_key text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_data (owner_id, key, payload, updated_at)
  values (auth.uid(), p_key, p_payload, now())
  on conflict (owner_id, key)
  do update set payload = excluded.payload, updated_at = now();
end;
$$;

-- Purge eventuelle d'une cle
create or replace function public.delete_app_data(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.app_data where owner_id = auth.uid() and key = p_key;
end;
$$;

-- ---------- CODES ADMIN (stockes en sha256, jamais en clair) ----------
create table if not exists public.admin_keys (
  code text primary key,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Revendique le role admin si le code (sha256) est connu et libre.
-- La mention "first admin only" est garantie par la RPC.
create or replace function public.claim_admin(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_hash := encode(sha256(coalesce(p_code, '')::bytea), 'hex');
    if exists (select 1 from public.admin_keys where code = v_hash and used = false) then
      update public.profiles set role = 'admin' where id = auth.uid();
      update public.admin_keys set used = true where code = v_hash;
      return true;
    end if;
  end if;
  return false;
end;
$$;

-- Valide un code admin sans effet de bord (utilise avant l'inscription)
create or replace function public.check_admin_code(p_code text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    return false;
  end if;
  return exists (
    select 1 from public.admin_keys
    where code = encode(sha256(coalesce(p_code, '')::bytea), 'hex') and used = false
  );
end;
$$;

-- Retrouve le role actuel du compte connecte
create or replace function public.get_my_role()
returns text
language plpgsql stable security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  return v_role;
end;
$$;

-- Retrouve l'email d'un compte a partir de son login (formulaire "identifiant")
create or replace function public.email_by_login(p_login text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text;
begin
  select u.email::text into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.login = p_login
  limit 1;
  return v_email;
end;
$$;

-- ---------- LEADS / MESSAGES CONTACT ----------
create table if not exists public.leads (
  id         bigint generated always as identity primary key,
  name       text not null,
  email      text not null,
  phone      text not null default '',
  subject    text not null default '',
  message    text not null default '',
  page       text not null default '',
  formula    text not null default '',
  created_at timestamptz not null default now()
);

-- Insertion anonyme permise (avec anti-spam basique cote client),
-- lecture reservee a l'administrateur.
create or replace function public.insert_lead(
  p_name text, p_email text, p_phone text,
  p_subject text, p_message text, p_page text, p_formula text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.leads (name, email, phone, subject, message, page, formula)
  values (coalesce(p_name, ''), coalesce(p_email, ''), coalesce(p_phone, ''),
          coalesce(p_subject, ''), coalesce(p_message, ''), coalesce(p_page, ''), coalesce(p_formula, ''));
end;
$$;

-- ---------- COMMANDES (intention / validation paiement Stripe) ----------
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles (id) on delete cascade,
  customer    text not null default '',
  formula     text not null default '',
  amount      numeric(10,2) not null default 0,
  status      text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at  timestamptz not null default now()
);

create or replace function public.create_order(
  p_formula text, p_customer text, p_amount numeric
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.orders (owner_id, customer, formula, amount, status)
  values (auth.uid(), coalesce(p_customer, ''), p_formula, p_amount, 'pending');
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.app_data       enable row level security;
alter table public.admin_keys     enable row level security;
alter table public.leads          enable row level security;
alter table public.orders         enable row level security;

-- profils : l'utilisateur lit son profil ; l'admin lit la liste
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- app_data : uniquement ses propres lignes
drop policy if exists "app_data_select" on public.app_data;
create policy "app_data_select" on public.app_data
  for select using (owner_id = auth.uid());

drop policy if exists "app_data_insert" on public.app_data;
create policy "app_data_insert" on public.app_data
  for insert with check (owner_id = auth.uid());

drop policy if exists "app_data_update" on public.app_data;
create policy "app_data_update" on public.app_data
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "app_data_delete" on public.app_data;
create policy "app_data_delete" on public.app_data
  for delete using (owner_id = auth.uid());

-- admin_keys : aucune lecture/ecriture directe (uniquement via RPC)
drop policy if exists "admin_keys_none" on public.admin_keys;
create policy "admin_keys_none" on public.admin_keys
  for all using (false) with check (false);

-- leads : insertion via RPC uniquement, lecture admin
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- orders : l'admin lit tout, le compte connecte sa propre commande
drop policy if exists "orders_admin_read" on public.orders;
create policy "orders_admin_read" on public.orders
  for select using (owner_id = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');