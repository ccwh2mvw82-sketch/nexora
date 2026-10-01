-- ============================================================
--  ROTATION DU CODE ADMIN  (à exécuter dans Supabase > SQL Editor)
-- ============================================================
--  POURQUOI
--  L'ancien code d'inscription admin était écrit en clair dans
--  js/config.js, versionné sur GitHub. Il a donc été public : il faut
--  le considérer comme compromis et le remplacer.
--
--  Les tables sont déjà protégées : les codes sont stockés en SHA-256 et
--  validés côté serveur par les fonctions check_admin_code() et
--  claim_admin() (voir schema.sql). Rien d'autre à installer.
--
--  ORDRE D'EXÉCUTION : COPYER TOUT LE BLOC D'UN SEUL COUP.
-- ============================================================

-- 1. Supprimer l'ancien code (marqué « utilisé » ou non)
delete from public.admin_keys
 where code = '58b892f3bb29f8134883629f15c729bcf1fc7dc50585c89f4124c5868fd9239f';

-- 2. Enregistrer le nouveau code, hashé en SHA-256
insert into public.admin_keys (code, used)
values ('6e2965d4a10268a8baf3d2a21138b0ff29a3fec6f4d29b391fd8f6b4835d520a', false)
on conflict (code) do update set used = false;

-- 3. Vérification : doit renvoyer exactement une ligne, used = false
select code, used, created_at
  from public.admin_keys
 order by created_at desc;

-- ============================================================
--  NOUVEAU CODE ADMIN :  GA-743280-0C26B613
--  (conservez ce code : c'est le seul moyen de créer votre compte admin)
--
--  MODE D'EMPLOI
--  1. Ouvrez le site, cliquez sur l'icône compte en haut à droite.
--  2. Onglet « Créer un compte ».
--  3. Renseignez vos identifiants, puis collez le code admin ci-dessus
--     dans le champ « Code d'inscription admin ».
--  4. Votre compte est créé avec le rôle administrateur.
--
--  Le code n'est stocké qu'en haché : personne, pas même vous via
--  l'interface, ne peut le relire. Notez-le dans un gestionnaire
--  de mots de passe. Il est à usage unique (colonne « used »).
--
--  ATTENTION : la fonction claim_admin() refuse d'attribuer le rôle
--  admin s'il existe DÉJÀ un administrateur dans la table profiles.
--  Donc : créez ce compte admin EN PREMIER. Les comptes créés ensuite
--  seront des comptes client.
-- ============================================================