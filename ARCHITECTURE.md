# Architecture — GestAffaires

> Document de référence (PHASE 0). Décrit **l'existant** avant toute évolution.
> Dernière mise à jour : PHASE 0. Branche de travail : `espace-travail-plus`.

## 1. Vue d'ensemble

GestAffaires est composé de **deux applications dans un même dépôt statique** :

1. **Site vitrine public** — pages marketing (pôles, formules, zones, mentions
   légales) destinées aux prospects et aux moteurs de recherche.
2. **Espace de travail privé** — application interne (après connexion) pour gérer
   clients, factures, devis, contrats, communication, acquisition, comptabilité,
   dossiers, reporting, IA.

Le tout est du **HTML/CSS/JS vanilla, sans étape de build**. Aucun bundler, aucun
`package.json`. Les fichiers sont servis tels quels.

## 2. Hébergement & déploiement

| Élément | Valeur |
|---|---|
| Hébergeur | **GitHub Pages** (branche `main`, dossier `/`) |
| Domaine public | `gestaffaires.fr` (fichier `CNAME`) |
| HTTPS | Certificat automatique GitHub Pages |
| En-têtes HTTP | Non personnalisables sur GitHub Pages → `netlify.toml` ignoré (conservé comme plan B) |
| En-têtes de sécurité | Via `<meta name="referrer">` dans chaque page |

**Conséquence importante** : toute modification poussée sur `main` est **déployée
automatiquement en production**. C'est pourquoi le travail en cours se fait sur la
branche `espace-travail-plus` (locale, non poussée sans autorisation).

## 3. Arborescence

```
Default Project/
├── index.html                     Page d'accueil
├── pole-temps.html                Pôle « gain de temps »
├── pole-visibilite.html           Pôle « visibilité »
├── pole-marches.html              Pôle « marchés publics »
├── creation-site-internet-artisan.html
├── gestion-devis-factures.html
├── referencement-local-google-business.html
├── zone-intervention.html         Page SEO locale (Châteauneuf-sur-Loire / Loiret)
├── mentions-legales.html
├── 404.html
├── robots.txt  sitemap.xml  CNAME  netlify.toml
├── css/                           style.css, admin.css
├── js/                            Voir §4
├── supabase/                      schema.sql + migrations + functions/ (Edge Functions)
├── assets/                        Images/icônes
├── SETUP.md                       Guide de mise en service (Supabase, Stripe, Resend)
├── ARCHITECTURE.md                Ce document
└── ROADMAP.md                     Suivi de progression des phases
```

Dossiers ignorés par git (`.gitignore`) : `pepite/`, `lou-*`, `qa*.html`,
`seo-tout-savoir.html`, `js/config.local.js`, `node_modules`.

## 4. Couche JavaScript

### 4.1 Scripts publics
| Fichier | Rôle |
|---|---|
| `js/site-info.js` | **Source unique** des infos société/contact (téléphone, e-mail, mentions légales, réseaux). Injectées via marqueurs `data-site="..."`. |
| `js/config.js` | Config **publique** versionnée : URL + clé publishable Supabase, URLs Stripe Payment Links. |
| `js/main.js` | Interactions du site public : tarifs/formules, recommandation, calcul heures supp, liens `tel:`/`mailto:`/WhatsApp, navigation. |
| `js/mobile.js` | Rendu `#mob-shell` (affiché par Googlebot mobile ≤ 720 px). |
| `js/gab.js` | **Pont cloud** : client Supabase léger, sync des données (`GW`), envoi des leads, création de commandes. |

### 4.2 Scripts de l'espace de travail
| Fichier | Rôle |
|---|---|
| `js/app.js` | **Historique** : panneau admin monolithique (onglets clients/factures/devis/contrats + auth + impression). Contient `hashPass()` et le store local historique. |
| `js/workspace.js` | Coquille de l'espace de travail : navigation par modules, page d'accueil/KPI, registre des modules, exports. |
| `js/workspace-g.js` | Modules **Gestion**, **Comptabilité**, `Dossiers`, **Reporting**. |
| `js/workspace-c.js` | Modules **Communication**, **Acquisition**, **Secrétariat**, **Assistant IA**. |
| `js/ws-clients.js` | Module **Clients**. |
| `js/ws-store.js` | **Sécurité/coffre** (phrase secrète, pièces jointes, sauvegarde). |

Panneau admin (`#admin-panel`) et feuille d'impression (`#print-sheet`) présents
sur les 8 pages principales ; **tous les modules sont chargés sur chaque page**.

### 4.2 Persistance (existant)
- Store applicatif `GW` (`js/gab.js`) : `GW.load(key)` / `GW.save(key, data)`.
- **Écriture** : toujours en `localStorage`, **et** vers Supabase `app_data`
  **seulement si** en mode cloud.
- **Mode cloud** : actif si le projet Supabase est configuré et le SDK chargé.
- **Repli** : 100 % local (localStorage) si Supabase absent.
- **Pièces jointes** : IndexedDB local uniquement.
- **Phrase secrète / sel** : localStorage local.

### 4.3 Points de fragilité connus (audit PHASE 0)
| # | Problème | Emplacement |
|---|---|---|
| 1 | Synchro inter-appareils non fiable : sauvegarde cloud uniquement si `isCloud()`, erreurs avalées | `js/gab.js:66,368-393` |
| 2 | Pas de migration local→cloud ni de file de reprise au login | `js/gab.js:389-423` |
| 3 | Pièces jointes uniquement locales (IndexedDB) | `js/ws-store.js:56-200` |
| 4 | Miroir local `ga_users`/`ga_session` utilisé pour `isAdmin()` | `js/workspace.js:73-80` |
| 5 | `hashPass()` = hash jouet (non cryptographique) | `js/app.js:50-58` |
| 6 | Dépenses client : écrites `montantHT`, relues `x.ht` | `js/workspace-g.js:405` / `js/ws-clients.js:375` |
| 7 | Faux numéros de téléphone générés | `js/workspace-c.js:381-388` |
| 8 | Noms de modèles Gemini invalides | `js/workspace-c.js:533-534` |
| 9 | `ga_media` lu mais jamais écrit, absent des `BIZ_KEYS` | `js/workspace-c.js:46,113,147` |
| 10 | Tarif 45 €/h figé dans le reporting | `js/workspace-g.js:553-607` |
| 10 | Statut devis incohérent (`envoye` vs `en_attente`) | `js/ws-clients.js:20` / `js/workspace-g.js:47` |
| 11 | Module Gestion ne peut pas créer facture/devis | `js/workspace-g.js:68-72` |
| 12 | Documents stockés en base64 dans le stockage | `js/workspace-g.js:497-524` |
| 13 | Duplication `app.js` ↔ modules workspace (mêmes clés `ga_*`, schémas divergents) | global |
| 9b | Tables `leads`/`orders` non exposées dans l'espace de travail | — |

## 5. Backend Supabase

Projet : `nmmciynglpqdgaivyqhv` (URL dans `js/config.js`, clé **publishable**).

### Tables (`supabase/schema.sql`)
| Table | Contenu |
|---|---|
| `profiles` | Profil lié à `auth.users` (nom, login, `role` ∈ {client, admin}) |
| `app_data` | Clés/valeurs JSON des modules, **par compte** (`owner_id`, `key`, `payload`) |
| `admin_keys` | Codes admin hachés sha256, usage unique |
| `leads` | Messages des formulaires de contact |
| `orders` | Commandes/intentions de paiement (`pending`/`paid`/`cancelled`) |

### RPC (SECURITY DEFINER)
`upsert_app_data`, `delete_app_data`, `claim_admin`, `check_admin_code`,
`get_my_role`, `email_by_login`, `insert_lead`, `create_order`, `complete_order`
(réservé service_role).

### RLS
Activée sur les 5 tables. Lecture/écriture limitées à `auth.uid()` ; `admin_keys`
inaccessible en direct ; `leads` lisibles par l'admin ; `orders` par le
propriétaire ou l'admin ; trigger anti-escalade de rôle sur `profiles`.

### Fichiers SQL annexes
`migration-securite.sql`, `migration-stripe.sql`, `activation-code-admin.sql`,
`diagnostic-code-admin.sql`, `rotation-code-admin.sql`.

## 5.5 Authentification & rôles
- Supabase Auth (e-mail/login). Confirmation e-mail **désactivée** sur ce projet.
- Rôles : `client` (tableau de bord limité) et `admin` (accès complet).
- Premier admin via un code secret (`admin_keys`), validé côté serveur.

## 6. Intégrations externes

| Service | Usage | État |
|---|---|---|
| **Supabase** | Auth, base, Edge Functions | Configuré (clés publiques en place) |
| **Stripe** | Payment Links par formule + webhook | Liens présents sauf `tpe`, `fondations` (vides) |
| **Stripe Edge Functions** | `stripe-checkout`, `stripe-webhook` | Code présent, **non déployées** |
| **Resend** | E-mail de notification des leads | Edge Function présente, **non déployée**, clé à poser |
| **Google Gemini** | Assistant IA de l'espace de travail | Noms de modèles invalides (à corriger) |
| **Google Business** | Avis/fidélisation (SEO local) | Fiche neuve, 0 avis |

Secrets requis côté Supabase (jamais dans le navigateur) : `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `RESEND_API_KEY`, `ADMIN_EMAIL`,
`FROM_EMAIL`, `SITE_URL`.

## 7. Contraintes & protections (non négociables)

- Ne **jamais** supprimer/reconstruire/remplacer le site ou l'espace de travail.
- Ne **jamais** renommer les routes/composants existants ni effacer une
  fonctionnalité.
- Ne **jamais** supprimer les configs Supabase/Stripe/Resend.
- Ne **jamais** lancer de migration destructrice ni réinitialiser des données.
- **Aucun déploiement en production sans autorisation** → travail sur branche.
- Migrations **additives** et versionnées, testées hors production.
- RLS jamais désactivée ; sécurité en priorité absolue.
- Montants en entiers (unités mineures), jamais en flottants.
- Ne pas inventer de données factuelles (société, SIRET, avis, chiffres).

## 8. Cible : « Espace de travail + » (haut niveau)

**Décision** : les outils de la **section « Espace de travail »** sont **remplacés**
par la nouvelle version professionnelle. Le **site public** et
l'**authentification** sont conservés. L'ancienne version reste disponible sur
`main` (récupérable via Git). Modèle retenu : **mono-organisation** (un compte
administrateur + ses collaborateurs).

Contenu cible :
- **Contexte client global** (sélecteur de client partagé par tous les modules) ;
- CRM (prospects, pipeline), missions/projets, tâches, GED, devis/factures,
  temps/forfaits, agenda, communications, sites/SEO, appels d'offres, contrats,
  automatisations, IA, portail client ;
- **persistance serveur Supabase** (fini le localStorage seul) : c'est aussi la
  réponse au bug de synchro inter-ordi ;
- rôles étendus (admin, responsable, collaborateur, client) et RLS adaptée ;
- n'y toucher qu'après avoir reconstruit l'équivalent (pas de trou fonctionnel).

Détail et découpage dans `ROADMAP.md`.

## 9. Stratégie de branche

- `main` = production (GitHub Pages). **Ne pas pousser sans autorisation.**
- Branche de travail : `espace-travail-plus` (créée depuis `e315612`).
- Les livraisons sont fusionnées sur `main` **uniquement** après validation
  explicite, par jalons.
