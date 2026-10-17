# Base de données — GestAffaires

> Référence du modèle de données Supabase (PostgreSQL). Voir aussi
> `SECURITY.md` et `ARCHITECTURE.md`.

## 1. Projet

- Projet Supabase : `nmmciynglpqdgaivyqhv`.
- Client : clé **publishable** uniquement (`js/config.js`). Jamais de clé
  `service_role` côté navigateur.
- RLS **activée partout**.

## 2. Tables

### `profiles`
Profil applicatif lié à `auth.users` (créé automatiquement au premier login).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | = `auth.users.id` |
| `name` | text | nom affiché |
| `login` | text unique | identifiant de connexion (sans @) |
| `role` | text | `client`, `admin`, `responsable`, `collaborateur` |
| `created_at` | timestamptz | |

### `app_data`
Données métier des modules, **clé/valeur JSON par comptes**. C'est le stockage
principal de l'espace de travail (clés `ga_*`).

| Colonne | Type | Notes |
|---|---|---|
| `owner_id` | uuid | `profiles.id` (partition) |
| `key` | text | ex. `ga_clients`, `ga_factures` |
| `payload` | jsonb | tableau/objet JSON |
| `updated_at` | timestamptz | |

Clé primaire `(owner_id, key)`.

### `admin_keys`
Codes d'administrateur **hachés sha256**, à usage unique. Aucun accès direct
(RLS `false`), uniquement via RPC.

### `leads`
Messages des formulaires de contact.

### `orders`
Intentions/commandes de paiement Stripe (`pending` → `paid`).

## 3. RPC (fonctions serveur `SECURITY DEFINER`)

| Fonction | Rôle |
|---|---|
| `upsert_app_data(key, payload)` | écrit une clé métier pour le compte connecté |
| `delete_app_data(key)` | supprime une clé métier |
| `claim_admin(code)` | promeut le 1er compte en admin si le code sha256 est libre |
| `check_admin_code(code)` | valide un code admin sans effet de bord |
| `get_my_role()` | renvoie le rôle du compte connecté |
| `email_by_login(login)` | retrouve l'e-mail à partir du login |
| `insert_lead(...)` | insère un message de contact (anonyme autorisé) |
| `create_order(...)` | enregistre une commande |
| `complete_order(...)` | marque payé — **service_role uniquement** |
| `is_staff()` *(migration ws2)* | vrai si admin/responsable/collaborateur |
| `org_owner()` *(migration ws2)* | identifiant du pool de données de l'organisation |

## 4. RLS (règles d'accès)

- `profiles` : lecture de son profil (ou tout pour un admin) ; mise à jour de son
  profil ; trigger anti-escalade de rôle.
- `app_data` : lecture/écriture de ses lignes ; en mode équipe (migration ws2),
  lecture du pool partagé pour les membres de l'équipe.
- `admin_keys` : aucun accès direct.
- `leads` : insertion via RPC, lecture admin.
- `orders` : lecture par le propriétaire ou l'admin.

## 5. Fichiers SQL (par ordre d'application)

1. `supabase/schema.sql` — socle complet (projet neuf).
- `supabase/migration-securite.sql`
- `supabase/migration-stripe.sql`
- `supabase/migration-ws2.sql` — rôles étendus + org partagée (additif).
- `activation-code-admin.sql`, `diagnostic-code-admin.sql`,
  `rotation-code-admin.sql` : gestion du code admin.

## 6. Application des migrations

Je (assistant) ne peux pas exécuter le SQL à distance (pas de CLI `supabase`).
**Toi** : Supabase Dashboard → **SQL Editor** → coller le fichier → **Run`.
Les migrations sont additives et idempotentes.

## 7. Flux de synchronisation (côté client)

1. Un module écrit via `GestWorkspace.save()` → `GAB.data.save` (`js/gab.js`).
2. Écriture immédiate en `localStorage`, puis mise en file d'attente cloud.
- La file est poussée vers `app_data` via la RPC `upsert_app_data`.
- En cas d'échec réseau : nouvelle tentative (délai progressif), reprise au
  rechargement, au retour du réseau et à la réouverture de l'onglet.
- Au login, les données locales absentes du cloud sont **remontées**
  automatiquement (migration silencieuse).
- État exposé via l'événement `gab:sync` (indicateur dans l'en-tête).

## 8. Convention des clés `ga_*`

`ga_clients`, `ga_factures`, `ga_devis`, `ga_contrats`, `ga_seq`, `ga_relances`,
`ga_depenses`, `ga_echeances`, `ga_documents`, `ga_heures`, `ga_planif`,
`ga_prospects`, `ga_campagnes`, `ga_appels`, `ga_rdv`, `ga_ia`, `ga_ws`.

## 9. Migrations documentées

| Fichier | Objet | Exécutée ? |
|---|---|---|
| `supabase/schema.sql` | socle initial | par l'utilisateur |
| `supabase/migration-securite.sql` | durcissement RLS | par l'utilisateur |
| `supabase/migration-stripe.sql` | tables orders/webhook | par l'utilisateur |
| `supabase/migration-ws2.sql` | rôles + espace partagé équipe | **à exécuter** (utile dès l'ajout de collaborateurs) |

> Aucune migration de ce dépôt n'est exécutée automatiquement par l'agent.
