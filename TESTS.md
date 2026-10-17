# Tests — GestAffaires

> Procédure de vérification de l'espace de travail et des modules. Voir aussi
> `ARCHITECTURE.md`, `INTEGRATIONS.md` et `ROADMAP.md`.

## 1. Contraintes

Le poste ne dispose **pas** de Node.js / npm / npx / Deno. Les tests se font donc
dans le navigateur (Chrome) via un petit serveur HTTP local : sous `file://`, les
erreurs JS sont masquées, il faut donc **toujours tester en HTTP**.

## 1. Serveur de test local

Script : `C:\Users\yacin\AppData\Local\Temp\opencode\qa-serve.ps1`
(écouteur HTTP sur le port **8732**, racine = racine du projet).

```powershell
$srv = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass',
  '-File','C:\Users\yacin\AppData\Local\Temp\opencode\qa-serve.ps1' -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 800
# ... tests ...
Stop-Process -Id $srv.Id -Force
```

## 2. Harnais automatique (`qa-check.html`)

Fichier temporaire (gitignoré, supprimé après test). Il charge tous les scripts de
l'espace de travail dans l'ordre, puis appelle `render()` sur chaque module,
capture les erreurs et affiche `ERRS:[…] | n:<modules>`.

Ordre de chargement : `site-info.js`, `GA_CONFIG`, `gab.js`, `main.js`, `app.js`,
`workspace.js`, `workspace-g.js`, `workspace-c.js`, `ws-store.js`, `ws-clients.js`,
`crm.js`, `operations.js`, `finance.js`, `communications.js`, `services.js`,
`admin-advanced.js`, `automation.js`.

Lancement (Chrome headless) :

```
chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=6000 \
  --dump-dom "http://localhost:8732/qa-check.html"
```

### Résultat attendu

- `ERRS:[]` (aucune erreur JavaScript).
- `n:25` modules rendus : gestion, compta, dossiers, reporting, communication,
  acquisition, secretariat, ia, securite, clients, crm, missions, agenda,
  facturation, temps, messagerie, modeles, portail, sites, appels_offres,
  contrats, documents, equipe, journal, automatisations.
- Un attribut `data-<module>="ok"` par module (non vide).

> Sous PowerShell 5.1, lire/écrire l'UTF-8 sans BOM via
> `[System.IO.File]::ReadAllText/WriteAllText` + `New-Object System.Text.UTF8Encoding($false)`.

## 3. Vérifications manuelles (navigateur)

Charger les 8 pages qui intègrent l'espace de travail :
`index.html`, `pole-temps.html`, `pole-visibilite.html`, `pole-marches.html`,
`creation-site-internet-artisan.html`, `gestion-devis-factures.html`,
`referencement-local-google-business.html`, `zone-intervention.html`.

- [ ] Console navigateur : aucune erreur rouge.
- [ ] Espace de travail : les 25 modules s'ouvrent sans écran vide.
- [ ] CRM : créer un prospect → convertir en client.
- [ ] Facturation : devis → facture ; TVA par ligne correcte ; total = HT + TVA.
- [ ] Temps : saisir des heures ; lien avec les missions.
- [ ] Automatisations : « Relancer les impayés » crée des relances ; journal mis à jour.
- [ ] Assistant IA : sans clé → mode hors-ligne ; avec clé valide → génération.
- [ ] Documents : ajout/suppression ; contenu chiffré (coffre).
- [ ] Journal : toute action critique est tracée.

## 4. Vérifications automatisées existantes

| Script | Objet |
|---|---|
| `qa-legal.ps1` | Champs légaux obligatoires présents dans `js/site-info.js` |
| `qa-jsonld.ps1` | Cohérence du JSON-LD de `index.html` avec `js/site-info.js` |

## 5. Déploiement (rappel)

Sur `espace-travail-plus` : `git commit` → `git checkout main` →
`git merge --ff-only espace-travail-plus` → `git push origin main` →
`git checkout espace-travail-plus`. GitHub Pages publie automatiquement.
