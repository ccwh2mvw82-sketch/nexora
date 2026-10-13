-- ============================================================
-- GestAffaires - Migration de securite (corrige la V1 de schema.sql)
--
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor > New query > Run
-- (le script est idempotent : on peut le relancer sans risque)
--
-- Corrige 2 problemes de la version precedente :
--   1. ESCALADE DE PRIVILEGES : la policy profiles_update_own laissait
--      un client faire `update profiles set role='admin' where id=auth.uid()`.
--      -> un trigger force desormais le role a rester inchange pour
--         tout compte qui n'est pas deja administrateur.
--   2. RECURSION RLS : profiles_select_own interrogeait public.profiles
--      dans sa propre policy ("infinite recursion detected in policy").
--      -> on passe par la fonction SECURITY DEFINER get_my_role().
--
-- Aucune donnee n'est supprimee ni modifiee par cette migration.
-- ============================================================

-- ---------- 0. Fonction de lecture du role (deja presente : on la rafraichit)
create or replace function public.get_my_role()
returns text
language plpgsql stable security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  return v_role;
end;
$$;

-- ---------- 1. Anti-escalade de privileges
-- SECURITY INVOKER : current_user vaut 'authenticated' pour un client mais
-- reste 'postgres'/'service_role' pour claim_admin() et le serveur. Sans
-- cela, le trigger annulerait la promotion du premier admin.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role
       and public.get_my_role() is distinct from 'admin' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_escalation on public.profiles;
create trigger profiles_prevent_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- ---------- 2. Policies profiles (suppression de la recursion RLS)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.get_my_role() = 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- 3. Policies leads / orders (idem, plus simples et rapides)
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select using (public.get_my_role() = 'admin');

drop policy if exists "orders_admin_read" on public.orders;
create policy "orders_admin_read" on public.orders
  for select using (owner_id = auth.uid() or public.get_my_role() = 'admin');

-- ---------- 4. Verification (facultatif) ----------
-- Apres execution, connecte en tant que client et lance :
--   update public.profiles set role = 'admin' where id = auth.uid();
--   select public.get_my_role();   -- doit rester 'client'
