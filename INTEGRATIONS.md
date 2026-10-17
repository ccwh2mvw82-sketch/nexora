# Intégrations — GestAffaires

> Ce document regroupe les services externes, les secrets à configurer et les
> étapes de mise en service. Voir aussi `SETUP.md` (démarrage), `DATABASE.md`,
> `SECURITY.md` et `ROADMAP.md`.

## 1. Supabase (base de données, auth, stockage)

- Projet : `nmmciynglpqdgaivyqhv` — URL `https://nmmciynglpqdgaivyqhv.supabase.co`.
- Le navigateur n'utilise que la clé **publishable** (`js/config.js`). La clé
  `service_role` ne vit que dans les secrets des Edge Functions.
- Auth : e-mail + mot de passe. Rôles : `client`, `admin`, `responsable`,
  `collaborateur`.
- Stockage (GED) : bucket privé `gesaffaires-files` + policies RLS par dossier
  utilisateur (voir section 4).

### Migrations SQL (SQL Editor, dans l'ordre)

| Fichier | Rôle |
|---|---|
| `supabase/schema.sql` | Projet neuf : tables `profiles`, `app_data`, `admin_keys`, `leads`, `orders` + RLS |
| `supabase/migration-securite.sql` | Renforcement sécurité (projet existant) |
| `supabase/migration-stripe.sql` | Tables/RPC de paiement |
| `supabase/migration-ws2.sql` | Espace de travail : partage du pool « équipe » (staff) |
| `supabase/activation-code-admin.sql` | Active un code admin (hash sha256) |
| `supabase/rotation-code-admin.sql` | Change/révoque un code admin |
| `supabase/diagnostic-code-admin.sql` | Vérifie l'état des codes admin |

> Projet neuf : exécuter seulement `schema.sql` puis le code d'activation.

### Edge Functions

| Fonction | JWT | Secrets requis |
|---|---|---|
| `stripe-checkout` | vérifié | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `SITE_URL`, `ALLOWED_ORIGINS` |
| `stripe-webhook` | **non vérifié** | `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_EMAIL`, `FROM_EMAIL`, `SITE_URL` |
| `send-notification` | **non vérifié** | `RESEND_API_KEY`, `ADMIN_EMAIL`, `FROM_EMAIL`, `ALLOWED_ORIGINS` |
| `send-message` | vérifié | `RESEND_API_KEY`, `FROM_EMAIL`, `SEND_SECRET`, `ALLOWED_ORIGINS` |

Déploiement sans CLI : **Edge Functions → Create a new function**, nom exact,
coller `supabase/functions/<nom>/index.ts`, puis **Deploy** (décocher « Verify
JWT » pour `stripe-webhook` et `send-notification`).

Avec la CLI (si installée) :

```
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-notification --no-verify-jwt
supabase functions deploy send-message
```

## 2. Stripe (paiements)

- Mode actuel : **Payment Links** renseignés dans `js/config.js` (aucune donnée
  bancaire ne transite par le site).
- Liens **encore vides** : `tpe`, `fondations` (à créer dans le dashboard).
- Retour client : régler `After payment → Redirect to` sur
  `https://gestaffaires.fr/?success=paiement`.
- Vérification serveur (optionnelle) : webhook Stripe `checkout.session.completed`
  vers `https://nmmciynglpqdgaivyqhv.supabase.co/functions/v1/stripe-webhook`,
  puis copier le *Signing secret* (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`.

> Seuls le marquage « payé » en base et l'e-mail automatique nécessitent le
> webhook et les `STRIPE_PRICE_*`. Le paiement par Payment Link fonctionne sans.

## 3. Resend (e-mails transactionnels)

- Compte créé avec l'adresse de réception ; sur l'offre gratuite, l'envoi est
  limité à cette adresse.
- Secret `RESEND_API_KEY` (`re_…`) dans **Project Settings → Edge Functions →
  Secrets**.
- Expéditeur : `FROM_EMAIL` (défaut `GestAffaires <no-reply@gestaffaires.fr>`).

## 4. Google Gemini (assistant IA de l'espace de travail)

- Clé gratuite : https://aistudio.google.com/apikey (commence par `AIza` ou `AQ.`).
- La clé est saisie **par l'utilisateur** dans le module « Assistant IA » et
  stockée **sur son appareil** (`localStorage`, clé `ga_ia`). Elle est envoyée à
  Google via l'en-tête `x-goog-api-key` (jamais dans l'URL, jamais à nos serveurs).
- Modèles proposés (`js/workspace-c.js`) : `gemini-3.5-flash`,
  `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`,
  `gemini-2.5-pro`. Repli par défaut : `gemini-3.5-flash`.
- Sans clé, le module fonctionne en **mode hors-ligne** (ébauches de texte).

## 5. Stockage des pièces jointes (GED serveur) — à finaliser

Actuellement, les pièces jointes sont **chiffrées côté navigateur** (AES-256-GCM,
`js/ws-store.js`) et conservées en local (IndexedDB). Pour un stockage serveur :

1. Créer un bucket **privé** dans Supabase Storage (ex. `gesaffaires-files`).
2. Ajouter des policies RLS par dossier `auth.uid()`.
3. Brancher `GW.files`/`GW.vault` sur l'API Storage (upload/download signés).

> Tant que ce n'est pas fait, aucun fichier n'est envoyé au serveur (choix
> volontaire : pas de données sensibles en clair, pas de base64 dans la base).

## 6. Récapitulatif des secrets

| Secret | Service | Utilisé par |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | `stripe-webhook` (interne) |
| `STRIPE_SECRET_KEY` | Stripe | `stripe-checkout` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `stripe-webhook` |
| `STRIPE_PRICE_*` | Stripe | `stripe-checkout` |
| `RESEND_API_KEY` | Resend | `send-notification`, `send-message`, `stripe-webhook` |
| `ADMIN_EMAIL`, `FROM_EMAIL`, `SITE_URL` | divers | fonctions de notification |
| `SEND_SECRET` | interne | `send-message` (en-tête `x-ga-key`) |
| `ALLOWED_ORIGINS` | interne | CORS des fonctions |

> Ne jamais placer ces valeurs dans `js/config.js` ni dans un fichier versionné.

## 7. Étapes manuelles restantes (checklist)

- [ ] Révoquer/régénérer la clé `sb_secret_…` précédemment exposée (SECURITY.md §5).
- [ ] Renseigner les **champs légaux** dans `js/site-info.js` (SIRET, forme, adresse, RCS, directeur).
- [ ] Créer les Payment Links `tpe` et `fondations`.
- [ ] Confirmer le mapping formules → `stripe.visibilite` / `visibilite_plus` / `developpement`.
- [ ] Déployer les 4 Edge Functions + poser les secrets.
- [ ] Branché la GED Storage (section 5).
- [ ] Activer le portail client **externe** authentifié (lecture seule) — Phase 5.
