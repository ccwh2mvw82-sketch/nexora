-- ============================================================
-- GestAffaires - Migration STRIPE (verification serveur des paiements)
--
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor > Run
-- (idempotent, relançable sans danger)
--
-- Ajoute :
--   1. complete_order() : RPC SECURITY DEFINER RESERVEE AU SERVEUR.
--      Seule l'Edge Function stripe-webhook (role service_role) peut la
--      caller, APRES verification de la signature Stripe. Toute tentative
--      publique (role anon / authenticated) leve une exception.
--   2. create_order() retourne desormais l'id cree (retro-compatible).
--   3. colonne stripe_session + index pour retrouver une commande par
--      e-mail ou par statut.
-- ============================================================

-- ---------- create_order : retourne l'id (void -> uuid)
create or replace function public.create_order(
  p_formula text, p_customer text, p_amount numeric
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.orders (owner_id, customer, formula, amount, status)
  values (auth.uid(), coalesce(p_customer, ''), p_formula, p_amount, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- complete_order : garde-fou anti-doublon et anti-spoofing
create or replace function public.complete_order(
  p_order_id uuid,
  p_stripe_session text default null
)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Appel refuse : reserve au serveur';
  end if;
  update public.orders
     set status = 'paid',
         stripe_session = coalesce(p_stripe_session, stripe_session)
   where id = p_order_id and status = 'pending';
  return found;
end;
$$;

-- ---------- Colonne + index
alter table public.orders add column if not exists stripe_session text not null default '';
create index if not exists orders_customer_lower_idx on public.orders (lower(customer));
create index if not exists orders_owner_status_idx on public.orders (owner_id, status);