-- ============================================================
--  DIAGNOSTIC + ACTIVATION DU CODE ADMIN
--  (a executer dans Supabase > SQL Editor, en un seul bloc)
-- ============================================================
--  RESULTAT ACTUEL : la fonction check_admin_code repond "false".
--  Elle fonctionne, donc le probleme n'est pas technique. Cela veut
--  dire que le code n'est pas dans la table admin_keys, OU qu'un
--  compte administrateur existe deja (auquel cas check_admin_code
--  refuse tout code, volontairement, pour qu'une seconde personne ne
--  puisse pas s'attribuer le role).
--
--  Ce bloc diagnostique, puis corrige. Il est idempotent : on peut
--  l'executer plusieurs fois sans risque.
-- ============================================================

-- ---------- ETAPE 1 : ETAT DES LIEUX ----------
select
  (select count(*) from public.admin_keys)                          as nb_codes_en_base,
  (select count(*) from public.admin_keys where used = false)       as nb_codes_libres,
  (select count(*) from public.profiles where role = 'admin')       as nb_admins_existants,
  (select count(*) from public.profiles)                            as nb_comptes;

-- Lisez cette ligne avant d'aller plus loin :
--   nb_admins_existants = 0  -> vous pouvez activer le code (etape 2)
--   nb_admins_existants > 0  -> un admin existe deja, le code est
--                               volontairement refuse :.connectez-vous
--                               avec ce compte, aucune action n'est requise.


-- ---------- ETAPE 2 : ACTIVER LE CODE (a faire si nb_admins_existants = 0) ----------
delete from public.admin_keys
 where code = '58b892f3bb29f8134883629f15c729bcf1fc7dc50585c89f4124c5868fd9239f';

insert into public.admin_keys (code, used)
values ('6e2965d4a10268a8baf3d2a21138b0ff29a3fec6f4d29b391fd8f6b4835d520a', false)
on conflict (code) do update set used = false;


-- ---------- ETAPE 3 : CONTROLE FINAL ----------
select
  (select count(*) from public.admin_keys where used = false) as nb_codes_libres,
  case
    when (select count(*) from public.profiles where role = 'admin') > 0
      then 'un admin existe deja : connectez-vous avec ce compte'
    when (select count(*) from public.admin_keys where used = false) > 0
      then 'OK : le code est actif, vous pouvez creer le compte'
    else 'ECHEC : le code n a pas pu etre enregistre'
  end as conclusion;

-- ============================================================
--  APRES L'ETAPE 3 : sur le site, icone compte (en haut a droite)
--  -> onglet "Creer un compte" -> collez le code recu separement.
--  Creez ce compte EN PREMIER : les suivants seront des comptes
--  clients. Le code est a usage unique.
--
--  Si check_admin_code repond toujours false apres l'etape 2 :
--  verifiez que le code colle dans le formulaire est identique, sans
--  espace avant/apres ni trait d'union transforme.
-- ============================================================