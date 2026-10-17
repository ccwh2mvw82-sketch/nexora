# ROADMAP — Espace de travail +

> Suivi de progression multi-sessions. Mise à jour à la fin de chaque phase.
> Branche de travail : `espace-travail-plus` (base `e315612`).

Légende statut : `[ ]` à faire · `[~]` en cours · `[x]` terminé · `[!]` bloqué.

---

## PHASE 0 — Audit et protection de l'existant — `[x]`
- [x] Inspection du dépôt (stack, build, arborescence).
- [x] Cartographie de la couche JS, de la persistance et de la navigation.
- [x] Inventaire Supabase : tables, RPC, RLS, migrations.
- [x] Inventaire des intégrations (Stripe, Resend, Gemini, Google Business).
- [x] Recensement des bugs et zones à risque.
- [x] Branche de travail `espace-travail-plus` créée (aucun push).
- [x] Documents de référence : `ARCHITECTURE.md`, `ROADMAP.md`.
- [x] Rapport de phase (voir conversation).
- Aucune action destructive · aucun déploiement.

---

## PHASE 1 — Fondations — `[x]`
Préparer le socle technique de « Espace de travail + » sans casser l'existant.
- [x] Mode d'intégration : remplacement des outils dans la section « Espace de
      travail » (acté en PHASE 0).
- [x] **Correction du bug de synchro inter-appareils** (`js/gab.js`) :
      file d'attente cloud, reprise après rechargement, nouvelle tentative avec
      délai progressif, reprise au retour du réseau, remontée locale→cloud au
      login, `saveAsync` qui renvoie une promesse et propage les erreurs.
- [x] **Correction du défaut de syntaxe `js/workspace-g.js:234`** (guillemets
      mélangés) qui empêchait le chargement de 5 modules (Gestion, Comptabilité,
      Dossiers, Reporting…). Vérifié : `modules` 5 → 10, 0 erreur JS.
- [x] Correction du bug « dépenses client » (`js/ws-clients.js:375` lisait `ht`
      au lieu de `montantHT`) — rétro-compatible.
- [x] Indicateur d'état de synchronisation dans l'en-tête de l'espace
      (`js/workspace.js` + `css/admin.css`).
- [x] Couche d'accès données serveur : socle en place (file + reprise + API
      `saveAsync`), utilisable par les nouveaux modules.
- [x] Rôles (admin, responsable, collaborateur, client) + RLS — migration
      additive écrite dans `supabase/migration-ws2.sql` (**à exécuter** par
      l'utilisateur dans Supabase ; utile dès l'ajout de collaborateurs).
- [x] Gabarit UI + design system : réutilisation de l'identité GestAffaires
      existante (`css/style.css`, `css/admin.css`).
- [x] Documentation : `DATABASE.md`, `SECURITY.md`, `ARCHITECTURE.md`.
- [ ] Corriger les autres bugs de l'audit (faux téléphones, modèles Gemini, TVA
      figée, statuts devis, GED base64) — repris en PHASE 9 (qualité) ou au fil
      des modules concernés.

## PHASE 2 — Noyau CRM — `[~]`
- [x] Prospects + pipeline commercial — module `CRM` (`js/crm.js`) : étapes
      (Nouveau → Contacté → Rendez-vous → Gagné/Perdu), valeur estimée,
      prochaine action, alerte retard, export Excel.
- [x] Activités et historique — clé `ga_crm_activities` (notes/appels/rdv/devis
      horodatés par prospect).
- [x] Conversion prospect → client.
- [x] Indicateurs CRM sur le tableau de bord d'accueil (prospects actifs,
      valeur du pipeline).
- [x] Données partagées avec l'existant : lecture/écriture de `ga_prospects`
      (aucune migration, aucune perte).
- [~] Fiches clients enrichies + contexte client global : le **contexte client
      global** (barre « Client actif ») est déjà en place ; la fiche client 360
      dédiée reste à construire.
- [ ] Remplacement effectif de l'ancien module `Acquisition` (cohabite
      aujourd'hui : mêmes données `ga_prospects`) une fois le suivi des
      campagnes Ads repris.

## PHASE 3 — Opérations — `[~]`
- [x] Missions / projets + tâches — module `Missions` (`js/operations.js`) :
      statut, client, dates, budget, checklist de tâches (échéance, assigné),
      avancement automatique, alerte tâches en retard, export.
- [x] Agenda — module `Agenda` : échéancier unifié agrégeant les tâches,
      factures à encaisser, échéances comptables et RDV, + événements manuels.
- [x] Correctif outil : `GW.money(nom, valeur)` accepte désormais une valeur
      initiale (les champs montants se pré-remplissent correctement).
- [ ] GED (documents) — stockage objet (Supabase Storage), remplace le
      stockage base64 actuel ; nécessite la création d'un bucket + policies.

## PHASE 4 — Suivi commercial & financier — `[~]`
- [x] Devis → facture — module `Facturation` (`js/finance.js`) : devis et
      factures (mêmes données `ga_devis`/`ga_factures` que l'existant),
      conversion d'un devis en facture en un clic, numérotation DE-/FA-AAAA-NNN.
- [x] TVA correcte — TVA **par ligne** (0 / 5,5 / 10 / 20 %), totaux HT/TVA/TTC
      calculés par `docTotals`.
- [x] Temps / forfaits — module `Temps` : saisie des heures, tarif horaire,
      valeur et statut « à facturer / facturé », export Excel.
- [x] Dépenses & échéances : déjà gérées par le module **Comptabilité**
      existant (dépenses, TVA, échéances URSSAF/CFE…).
- [~] Lien Stripe ↔ client : lien de paiement déduit de la formule du client
  + enregistrement du règlement depuis la facture ; reste à brancher la
  réception automatique des paiements (Edge Function stripe-webhook).
- [ ] Reporting financier consolidé (CA, encaissé, impayés, TVA) — le module
      `Reporting` existant à enrichir.

## PHASE 5 — Communications & portail client — `[~]`
- [x] Messagerie — module `Messagerie` (`js/communications.js`) : rédaction,
      modèles avec variables ({client}, {societe}, {date}), envoi e-mail
      (fonction serveur optionnelle) ou ouverture dans la messagerie, journal.
- [x] Modèles de message — module `Modèles` (gabarits d'e-mails).
- [x] Suivi des échanges — historique par client (`ga_messages`).
- [x] Portail client — module `Portail client` : aperçu en lecture des devis,
      factures, documents et messages du client.
- [x] Fonction serveur `send-message` créée (Resend) — à déployer par
      l'utilisateur ; refuse les envois sans `SEND_SECRET` (pas de relais ouvert).
- [ ] Portail client **externe** sécurisé (compte de rôle « client ») : le
      rendu et l'aperçu sont prêts ; l'accès authentifié reste à ouvrir.

## PHASE 6 — Services numériques — `[x]`
- [x] Sites & SEO — module `Sites & SEO` (`js/services.js`) : sites suivis,
      type, statut, échéance de domaine, Google Business, notes SEO.
- [x] Appels d'offres — module `Appels d'offres` : veille marchés, acheteur,
      date limite (alerte dépassement), montant, statut, pipeline.
- [x] Contrats — module `Contrats` (compatible `app.js` : num/titre/montant/
      statut) : contrat client, dates, revenu récurrent.

## PHASE 7 — Dossiers admin avancés — `[x]`
- [x] Documents / GED chiffrée — module `Documents` (`js/admin-advanced.js`) :
      registre de métadonnées (titre, catégorie, date, échéance) + pièces
      chiffrées AES-256-GCM dans le coffre, sans base64. Remplace le stockage
      base64 du module « Dossiers ».
- [x] Comptes & rôles — module `Équipe` : admin / responsable / collaborateur
      / client (mono-organisation).
- [x] Journal d'activité (audit) — module `Journal` + helper `GW.journal(...)`
      appelé par les actions sensibles.

## PHASE 8 — Automatisation & IA — `[x]`
- [x] Assistant Gemini `js/workspace-c.js` : modèles valides
  (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`,
  `gemini-2.5-flash`, `gemini-2.5-pro`), clé transmise par en-tête
  `x-goog-api-key` (plus dans l'URL).
- [x] `js/automation.js` : module « Automatisations » (relances d'impayés,
  échéances → agenda, accueil nouveaux clients) + journal `ga_automation_log`.

## PHASE 9 — Qualité & finalisation — `[ ]`
- [ ] Tests, `TESTS.md`, revue sécurité/RGPD, documentation finale.

---

## Documentation à produire
- [x] `ARCHITECTURE.md`
- [x] `ROADMAP.md`
- [x] `DATABASE.md`
- [ ] `INTEGRATIONS.md`
- [x] `SECURITY.md`
- [ ] `TESTS.md`
- (existant) `SETUP.md`

## Décisions actées
1. **Mode d'intégration** : **remplacer** les outils dans la section « Espace de
   travail » (site public + authentification conservés ; ancienne version
   récupérable sur `main`). Pas de nouvelle section séparée.
2. **Comptes** : **mono-organisation** (un compte admin + collaborateurs).
3. **Commits** : un commit sur `espace-travail-plus` à la fin de chaque phase ;
   **jamais** de push/pull vers `main` sans accord.
4. Stratégie de branche : travail sur `espace-travail-plus`, fusion par jalons
   après validation.

## Décisions en attente de l'utilisateur
1. **Confirmation des clés Stripe** : `f-notoriete → visibilite`,
   `f-acquisition → visibilite_plus`, `f-acquisition-plus → developpement`
   (mapping actuel posé par hypothèse) ; liens `tpe` et `fondations` à créer.
2. **Champs légaux** de `js/site-info.js` (SIRET, forme juridique, adresse, RCS,
   directeur) + téléphone/réseaux/avis.
