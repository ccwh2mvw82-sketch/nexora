# Mise en place du site "réel" (Supabase + GitHub Pages + Stripe)

Le site reste 100 % fonctionnel sans rien faire : en mode local (localStorage).
Ce guide active le mode **cloud** : vrais comptes, vraie base de données,
vrais formulaires de contact et vrais paiements — le tout gratuitement.

> Trois services gratuits suffisent (Supabase, GitHub Pages, Stripe).
> Temps total : ~30 minutes, une seule fois.

---

## 0. À finaliser (une seule fois)

Tout se règle dans `js/site-info.js`, sauf le téléphone qui doit aussi être mis
à jour dans le bloc JSON-LD de `index.html` :

| Champ | Où | Obligatoire |
|---|---|---|
| Téléphone | `js/site-info.js` (`phoneDisplay`, `phoneDigits`) | recommandé |
| WhatsApp | `js/site-info.js` (`whatsapp`, sinon réutilise `phoneDigits`) | recommandé |
| Numéro SIRET | `js/site-info.js` (`siret`) | **oui** |
| Forme juridique | `js/site-info.js` (`legalForm`) | **oui** |
| Adresse du siège | `js/site-info.js` (`address`) | **oui** |
| RCS | `js/site-info.js` (`rcs`) | **oui** |
| Directeur de publication | `js/site-info.js` (`director`) | **oui** |

Contrôle automatique : lancer `qa-legal.ps1` — plus aucun champ **obligatoire**
ne doit rester « MANQUE ». Le téléphone est **facultatif** : laissé vide, il est
automatiquement **masqué** (liens `tel:`/WhatsApp cachés, aucun faux numéro
publié). Le JSON-LD de `index.html` n'a plus besoin d'être édité à la main :
`qa-jsonld.ps1` vérifie sa cohérence avec `js/site-info.js`.

---

## 1. Supabase — comptes, données, sécurité

1. Va sur https://supabase.com → **New project** (n'importe quel nom, mot de passe DB).
2. Une fois le projet créé, ouvre **SQL Editor** → colle **tout** le contenu de
   `supabase/schema.sql` → **Run**. (Créé les tables `profiles`, `app_data`,
   `admin_keys`, `leads`, `orders` + toutes les règles de sécurité RLS.)
3. Dans le même SQL Editor, lance cette requête **une seule fois** pour activer
   ton code d'administrateur (remplace `MOT_DE_PASSE_ADMIN` par un code secret) :
   ```sql
   insert into admin_keys (code, used)
   values (encode(sha256('MOT_DE_PASSE_ADMIN'::bytea), 'hex'), false)
   on conflict (code) do update set used = false;
   ```
   → Le premier compte qui s'inscrit avec ce code devient **administrateur**.
   Le code reste stocké haché côté serveur : il n'est jamais envoyé au navigateur.
4. Récupère tes clés publiques : **Settings → API → Project URL** et la clé
   **publishable** (`sb_publishable_…` ; les anciens projets l'appellent
   « anon key »).
5. **Auth → Providers → Email** : sur ce projet, "Confirm email" est **désactivée**
   (`mailer_autoconfirm = true`) → le compte est actif immédiatement après
   l'inscription. **Important** : si tu la réactives un jour, il faut aussi
   configurer un fournisseur SMTP réel (Auth → SMTP), sinon les e-mails de
   confirmation ne partent pas et l'inscription semble bloquée.

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
   mets ton adresse du site + `?success=paiement` (ex. `https://gestaffaires.fr/?success=paiement`)
   : le visiteur reviendra sur ton site avec une confirmation affichée en haut de page.

> Le Payment Link gère lui-même carte, SCA, e-mail de reçu et facture.
> Chaque "Commander" enregistre aussi la commande dans ta base si le visiteur
> est connecté. Aucune donnée de carte ne passe par ton site.

## 4. E-mails des demandes (Resend)

Chaque demande du site (formulaires contact) arrive dans la table `leads`
**et** est aussi envoyée par e-mail à `gestaffaires45@gmail.com`.

1. Va sur https://resend.com → **Sign up** avec l'adresse de réception
   (`gestaffaires45@gmail.com`), puis valide le code reçu par e-mail.
   > Important : sur l'offre gratuite, un e-mail ne peut partir que vers
   > l'adresse du compte. Le compte doit donc être créé **avec l'adresse
   > de réception**.
2. **API Keys → Create API Key** → permission **Sending access** → copie la clé.
3. Dans Supabase : **Settings → Edge Functions → Secrets** → ajoute
   la variable `RESEND_API_KEY` (coller la clé `re_...`).
4. Le site appelle la fonction `send-notification` (déployée dans Supabase)
   à chaque demande. Le destinataire admin vient du secret `ADMIN_EMAIL` et
   l'expéditeur du secret `FROM_EMAIL` (voir §4 ter) : aucune valeur n'est
   codée en dur dans le code.
5. Tant que `RESEND_API_KEY` n'est pas fournie, la fonction répond sans erreur
   (`{admin:false, client:false}`) et le message reste bien stocké dans la
   table `leads`. Pour un expéditeur professionnel, vérifie un domaine dans
   Resend (Resend → **Domains**) puis mets `FROM_EMAIL` sur ce domaine.

## 4 bis. GitHub Pages — adresse publique (HTTPS + domaine)

1. Le dépôt est déjà publié via **GitHub Pages** (Settings → Pages → branche
   `main`, dossier `/`). Le fichier `CNAME` contient `gestaffaires.fr`.
2. Côté registrar / DNS du domaine, fais pointer vers GitHub Pages :
   - `A` pour `gestaffaires.fr` → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - `CNAME` pour `www` → `<compte>.github.io`
3. Dans **Settings → Pages**, coche **Enforce HTTPS** (certificat automatique).
   Tant que ce n'est pas coché, `http://gestaffaires.fr` répond sans rediriger
   vers HTTPS.

> Limite de GitHub Pages : impossible d'ajouter des **en-têtes HTTP
> personnalisés** (CSP, X-Frame-Options...). La politique « referrer » est
> assurée par la balise `<meta name="referrer">` de chaque page. Le fichier
> `netlify.toml` n'est lu que si le site est un jour hébergé sur Netlify.

## 4 ter. Paiement vérifié + e-mails automatiques (fonctions Supabase)

Le bouton « Commander » fonctionne déjà avec les **Payment Links** Stripe. Pour
que la commande soit automatiquement marquée « payée » en base **et** qu'un
e-mail parte à chaque paiement, déploie les 3 fonctions Edge (une seule fois) :

1. **Sans CLI (le plus simple, via le dashboard)** : **Edge Functions →
   Create a new function**, donne-lui le nom exact (`stripe-checkout`,
   `stripe-webhook`, `send-notification`), colle le contenu du fichier
   `supabase/functions/<nom>/index.ts` correspondant, puis **Deploy**.
   Pour `stripe-webhook` et `send-notification`, décoche **Verify JWT**
   (équivalent de `--no-verify-jwt`). Les secrets se posent dans
   **Project Settings → Edge Functions → Secrets** (ou Edge Functions →
   Manage secrets).
2. **Avec la CLI** : installe-la (`npm i -g supabase`), puis `supabase login`
   et `supabase link --project-ref <ref-du-projet>`, et déploie :
   ```
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy send-notification --no-verify-jwt
   ```
3. Renseigne les secrets (**Settings → Edge Functions → Secrets**) :
   - `STRIPE_SECRET_KEY` (clé secrète `sk_...`)
   - `STRIPE_WEBHOOK_SECRET` (voir étape 4)
   - `RESEND_API_KEY`
   - `ADMIN_EMAIL`, `FROM_EMAIL`, `SITE_URL`
   - `STRIPE_PRICE_...` (un ID de prix `price_...` par formule ; s'ils sont
     absents, le site retombe automatiquement sur les Payment Links)
4. Dans Stripe → **Developers → Webhooks → Add endpoint** :
   URL `https://<projet>.supabase.co/functions/v1/stripe-webhook`, événement
   `checkout.session.completed`. Copie le **Signing secret** (`whsec_...`) dans
   `STRIPE_WEBHOOK_SECRET`.
5. Base de données : si le projet Supabase existe déjà, exécute une fois dans le
   SQL Editor les fichiers `supabase/migration-securite.sql` puis
   `supabase/migration-stripe.sql`. Un projet neuf n'a besoin que de
   `supabase/schema.sql`.

> Sans ces étapes, le site reste 100 % utilisable : paiement par Payment Link et
> retour de confirmation via `?success=paiement`. Seuls le marquage « payé » en
> base et l'e-mail automatique nécessitent les fonctions.

## 5. Vérifications

- Inscription : bouton "Connexion" → "Créer un compte". Avec le code admin →
  rôle administrateur. Sans code → rôle client (tableau de bord limité).
  (Sur ce projet, la confirmation e-mail est désactivée : le compte est
  utilisable immédiatement, sans lien de confirmation.)
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
| Vérification paiement | Webhook Stripe → RPC `complete_order` (service_role uniquement) |
| HTTPS | Fourni par GitHub Pages (certificat auto, à activer) |
| En-têtes HTTP | GitHub Pages ne les permet pas ; « referrer » via balise `<meta>` |

## Rappels

- Ne mets **jamais** la clé `service_role` dans `js/config.js` (elle donne accès
  à tout sans RLS). C'est une clé serveur.
- `js/config.js` contient des clés publiques : elles peuvent être committées.
- Si tu veux repasser en mode local, vide les champs `supabase.url` et
  `supabase.anonKey` dans `js/config.js`.