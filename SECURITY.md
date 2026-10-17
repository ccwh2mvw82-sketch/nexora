# Sécurité — GestAffaires

> Référence sécurité de l'application (site public + espace de travail).
> Voir aussi `DATABASE.md` et `ARCHITECTURE.md`.

## 1. Principes

- **Aucun secret dans le navigateur.** `js/config.js` ne contient que des valeurs
  publiques par conception (URL Supabase, clé *publishable*, liens Stripe).
- La clé `service_role` (accès total sans RLS) ne doit **jamais** être versionnée
  ni exposée. Elle vit uniquement dans les secrets des Edge Functions Supabase.
- Toute la sécurité d'accès aux données repose sur les **policies RLS** côté base.

## 2. Authentification

- Supabase Auth (e-mail + mot de passe, bcrypt/argon géré par Supabase).
- Rôles : `client`, `admin`, `responsable`, `collaborateur`.
- Le **premier** administrateur est promu par un **code secret** stocké haché
  (`admin_keys`, sha256) et validé **côté serveur** (`check_admin_code` /
  `claim_admin`). Le code n'est jamais envoyé au navigateur.
- Confirmation d'e-mail **désactivée** sur ce projet (`mailer_autoconfirm`).

## 3. Contrôle d'accès (RLS)

- `app_data` : chacun n'accède qu'à ses lignes ; l'équipe (staff) partage le pool
  de l'organisation (voir `migration-ws2.sql`).
- `leads` : insertion anonyme via RPC, lecture admin uniquement.
- `orders` : lecture par le propriétaire ou l'admin ; `complete_order` réservé au
  `service_role`.
- `admin_keys` : aucun accès direct.

## 4. Secrets et intégrations

| Secret | Où | Ne jamais |
|---|---|---|
| `STRIPE_SECRET_KEY` | secrets Edge Functions | exposer côté client |
| `STRIPE_WEBHOOK_SECRET` | secrets Edge Functions | — |
| `STRIPE_PRICE_*` | secrets Edge Functions | — |
| `RESEND_API_KEY` | secrets Edge Functions | — |
| clé `service_role` Supabase | serveur uniquement | committer |

## 5. Risques connus (audit PHASE 0)

| # | Risque | Emplacement | Statut |
|---|---|---|---|
| 1 | `hashPass()` = hash jouet (non cryptographique) utilisé par l'ancien panneau | `js/app.js:50-58` | à traiter |
| 2 | `isAdmin()` du shell s'appuie sur un **miroir local** `ga_users`/`ga_session` | `js/workspace.js:73-80` | garde-fou serveur requis |
| 3 | Pièces jointes stockées en **local (IndexedDB)** — non synchronisées, non chiffrées | `js/ws-store.js:56-200` | à traiter (GED serveur) |
| 4 | Phrase secrète / sel du coffre en localStorage | `js/ws-store.js:13,31-36` | à traiter |
| 5 | Clé `sb_secret_…` précédemment exposée en clair | historique | **à révoquer/régénérer** |

Le point 2 est atténué par le fait que **les données réelles sont protégées par
RLS côté serveur** : même si un utilisateur force l'affichage du shell, il ne
peut pas lire les données d'autrui. Le risque résiduel est l'affichage de
l'interface.

## 6. Journalisation et RGPD

- Minimisation : ne stocker que les données utiles au service.
- Droits (accès, rectification, effacement) : à outiller via la base.
- Rétention : à définir par type de donnée.
- Traçabilité proportionnée : pas de surveillance excessive des utilisateurs.

## 7. Bonnes pratiques de l'agent

- Migrations **additives** uniquement, jamais destructrices.
- Aucune désactivation de RLS.
- Aucun secret committé ; toute valeur sensible passe par les secrets serveur.
- Signaux d'alarme à signaler : secrets exposés, RLS désactivée, accès anormal.
