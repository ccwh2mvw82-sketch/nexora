# Mise en place du site "réel" (Supabase + Netlify + Stripe)

Le site reste 100 % fonctionnel sans rien faire : en mode local (localStorage).
Ce guide active le mode **cloud** : vrais comptes, vraie base de données,
vrais formulaires de contact et vrais paiements — le tout gratuitement.

> Trois comptes gratuits sont nécessaires (Supabase, Netlify, Stripe).
> Temps total : ~30 minutes, une seule fois.

---

## 1. Supabase — comptes, données, sécurité

1. Va sur https://supabase.com → **New project** (n'importe quel nom, mot de passe DB).
2. Une fois le projet créé, ouvre **SQL Editor** → colle **tout** le contenu de
   `supabase/schema.sql` → **Run**. (Créé les tables `profiles`, `app_data`,
   `admin_keys`, `leads`, `orders` + toutes les règles de sécurité RLS.)
3. Dans le même SQL Editor, lance cette requête **une seule fois** pour activer
   ton code d'administrateur (remplace `MOT_DE_PASSE_ADMIN` par un code secret) :
   ```sql
   insert into admin_keys (code)
   select encode(sha256('MOT_DE_PASSE_ADMIN'), 'hex');
   ```
   → Le premier compte qui s'inscrit avec ce code devient **administrateur**.
   Le code reste stocké haché côté serveur : il n'est jamais envoyé au navigateur.
4. Récupère tes clés publiques : **Settings → API → Project URL** et **anon key**.
5. (Optionnel) **Auth → Providers → Email** : laisse "Confirm email" activée pour
   la double vérification, ou désactive-la pour une connexion immédiate.

## 2. Configuration du site

1. Ouvre `js/config.js` (déjà présent, copies des valeurs vides).
2. Colle :
   - `supabase.url` → la **Project URL**
   - `supabase.anonKey` → la **anon key**
3. Commit et pousse ces valeurs (elles sont publiques par conception : la
   sécurité réelle vient des règles RLS côté base, pas de ces clés).

## 3. Stripe — paiement des formules

1. Va sur https://dashboard.stripe.com/payment-links → **Nouveau lien**.
2. Crée (ou choisis) un **produit/prix** par formule :
   Essentiel 350 € · Confort 600 € · Pro 1 000 € · Visibilité 690 € ·
   Visibilité Plus 850 € · Développement 1 290 €.
3. Pour chacun, copie l'URL du Payment Link dans `js/config.js`
   (`stripe.essentiel`, `stripe.confort`, `stripe.pro`, `stripe.visibilite`,
   `stripe.visibilite_plus`, `stripe.developpement`).
4. (Retour client) Dans le Payment Link, section **After payment → Redirect to**,
   mets ton adresse du site + `?success=paiement` (ex. `https://<nom>.netlify.app/?success=paiement`)
   : le visiteur reviendra sur ton site avec une confirmation affichée en haut de page.

> Le Payment Link gère lui-même carte, SCA, e-mail de reçu et facture.
> Chaque "Commander" enregistre aussi la commande dans ta base si le visiteur
> est connecté. Aucune donnée de carte ne passe par ton site.

## 4. Netlify — adresse publique (HTTPS + domaine)

Le plus simple : connecter le dépôt GitHub.

1. Va sur https://app.netlify.com → **Add new site → Import an existing project**
   → choisis ce dépôt GitHub → **Deploy site**.
2. Quelques secondes plus tard tu obtiens un domaine `https://<nom>.netlify.app`.
   (Les règles des en-têtes de sécurité sont dans `netlify.toml`, déjà incluses.)
3. (Optionnel, ~3 €/mois) **Domain management → Add custom domain** pour
   acheter/personnaliser un vrai nom de domaine (ex. `gestaffaires.fr`).

## 5. Vérifications

- Inscription : bouton "Connexion" → "Créer un compte". Avec le code admin →
  rôle administrateur. Sans code → rôle client (tableau de bord limité).
  (Si la confirmation e-mail est active, vérifie ta boîte mail.)
- Données : les clients/factures/devis/contrats et les modules de l'espace de
  travail sont maintenant sauvegardés par compte dans Postgres.
- Vous pouvez consulter les lignes dans **Supabase → Table Editor**.

## Sécurité en place

| Risque | Solution |
|---|---|
| Mots de passe | Gérés par Supabase Auth (bcrypt/argon, jamais stockés par toi) |
| Accès aux données | RLS : chacun ne lit/écrit que sa scope (`auth.uid()`) |
| Compte admin | Code validé côté serveur (table `admin_keys`, hash sha256) |
| Formulaires contact | Envoyés dans `leads`, lisibles par l'admin uniquement |
| Paiement | Stripe Payment Links (aucune donnée bancaire sur ton serveur) |
| HTTPS | Fourni par Netlify (certificat auto) |
| En-têtes HTTP | nosniff / X-Frame-Options / Referrer dans netlify.toml |

## Rappels

- Ne mets **jamais** la clé `service_role` dans `js/config.js` (elle donne accès
  à tout sans RLS). C'est une clé serveur.
- `js/config.js` contient des clés publiques : elles peuvent être committées.
- Si tu veux repasser en mode local, vide les champs `supabase.url` et
  `supabase.anonKey` dans `js/config.js`.