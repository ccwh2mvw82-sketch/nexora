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

## PHASE 1 — Fondations — `[ ]`
Préparer le socle technique de « Espace de travail + » sans casser l'existant.
- [ ] Décider du mode d'intégration (section séparée vs extension) et de la route.
- [ ] Modèle de données multi-tenant (organisations/équipes) — migration additive.
- [ ] Étendre les rôles (admin, responsable, collaborateur, client) + RLS.
- [ ] Couche d'accès données serveur (remplacer le localStorage-seul).
- [ ] Corriger les bugs bloquants de l'audit (synchro, dépenses client, TVA...).
- [ ] Gabarit UI + design system cohérent avec l'identité GestAffaires.
- [ ] Documentation : `DATABASE.md`, `SECURITY.md`.

## PHASE 2 — Noyau CRM — `[ ]`
- [ ] Prospects + pipeline commercial.
- [ ] Fiches clients enrichies + **contexte client global**.
- [ ] Contacts, activités, historique.

## PHASE 3 — Opérations — `[ ]`
- [ ] Missions/projets, tâches, planning.
- [ ] GED (documents) — stockage objet, pas base64.
- [ ] Agenda.

## PHASE 4 — Suivi commercial & financier — `[ ]`
- [ ] Devis → facture, TVA correcte.
- [ ] Temps / forfaits, dépenses, reporting.
- [ ] Lien Stripe ↔ client.

## PHASE 5 — Communications & portail client — `[ ]`
- [ ] E-mail, modèles, suivi.
- [ ] Portail client sécurisé.

## PHASE 6 — Services numériques — `[ ]`
- [ ] Sites/SEO, appels d'offres, contrats.

## PHASE 7 — Dossiers admin avancés — `[ ]`

## PHASE 8 — Automatisation & IA — `[ ]`
- [ ] Corriger l'assistant Gemini (modèles valides) ; automatisations.

## PHASE 9 — Qualité & finalisation — `[ ]`
- [ ] Tests, `TESTS.md`, revue sécurité/RGPD, documentation finale.

---

## Documentation à produire
- [x] `ARCHITECTURE.md`
- [x] `ROADMAP.md`
- [ ] `DATABASE.md`
- [ ] `INTEGRATIONS.md`
- [ ] `SECURITY.md`
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
