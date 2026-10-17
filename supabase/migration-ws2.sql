-- ============================================================
-- GestAffaires - Migration "Espace de travail +" (PHASE 1)
--
-- ADDITIVE et NON DESTRUCTIVE. A executer UNE FOIS dans
-- Supabase > SQL Editor (aucune donnee n'est supprimee).
--
-- Modele retenu : MONO-ORGANISATION.
--   - L'equipe (admin / responsable / collaborateur) partage UN SEUL pool
--     de donnees (les clients voient uniquement les leurs).
--   - Avec un seul compte administrateur (situation actuelle), le
--     comportement est identique a avant : rien ne change.
--   -> A executer seulement si tu ajoutes des collaborateurs.
-- ============================================================

-- 1. Roles supplementaires ------------------------------------
-- (les valeurs existantes 'client' et 'admin' restent valides)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'admin', 'responsable', 'collaborateur'));

-- 2. Fonctions utilitaires ------------------------------------
-- "is_staff" : le compte connecte fait-il partie de l'equipe ?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.role in ('admin', 'responsable', 'collaborateur')
       from public.profiles p where p.id = auth.uid()),
    false);
$$;

-- Proprietaire unique du pool de donnees de l'organisation
-- (le premier administrateur cree). Permet a toute l'equipe de partager
-- les memes donnees sans casser le mono-admin existant.
create or replace function public.org_owner()
returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.id from public.profiles p where p.role = 'admin'
       order by p.created_at asc limit 1),
    auth.uid());
$$;

-- 3. app_data : ecriture et lecture partagees par l'equipe -----
-- Les RPC sont SECURITY DEFINER : elles rangent les donnees de l'equipe
-- sous l'identifiant org_owner(). Un client garde ses propres donnees.
create or replace function public.upsert_app_data(p_key text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  v_owner := case when public.is_staff() then public.org_owner() else auth.uid() end;
  insert into public.app_data (owner_id, key, payload, updated_at)
  values (v_owner, p_key, p_payload, now())
  on conflict (owner_id, key)
  do update set payload = excluded.payload, updated_at = now();
end;
$$;

create or replace function public.delete_app_data(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  v_owner := case when public.is_staff() then public.org_owner() else auth.uid() end;
  delete from public.app_data where owner_id = v_owner and key = p_key;
end;
$$;

-- L'equipe lit tout le pool de l'organisation ; un client ne lit que le sien.
drop policy if exists "app_data_select" on public.app_data;
create policy "app_data_select" on public.app_data
  for select using (owner_id = auth.uid() or public.is_staff());

-- ============================================================
-- Fin de la migration. Elle est idempotente : on peut la relancer.
-- ============================================================
