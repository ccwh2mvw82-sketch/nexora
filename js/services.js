/* ============================================================
   GestAffaires – « Espace de travail + » : MODULE SERVICES NUMÉRIQUES
   - Sites & SEO : sites livrés/hébergés, domaine, référencement.
   - Appels d'offres : veille marchés publics, suivi des dossiers.
   - Contrats : contrats clients (compatible app.js : num/titre/montant).
   Clés : ga_sites, ga_ao, ga_contrats.
   ============================================================ */

(function (GW) {
  "use strict";
  if (!GW) return;

  var esc = GW.esc, money = GW.fmtMoney, dateF = GW.fmtDate;
  var findClient = GW.findClient, clientLabel = GW.clientLabel;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var main = function () { return document.getElementById("admin-main"); };
  function cid() { return GW.currentClientId(); }
  function by(list) { var id = cid(); return id ? list.filter(function (x) { return x.clientId === id; }) : list; }
  /* ==================================================================
     MODULE : SITES & SEO
     ================================================================== */
  var SSTAT = { actif: ["Actif", "ok"], en_cours: ["En cours", "warn"], livre: ["Livré", "ok"], archive: ["Archivé", "grey"] };
  var sView = { mode: "list", id: null };
  var tbS = [];
  function sites() { return GW.get("ga_sites"); }
  function saveSites(l) { GW.put("ga_sites", l); }

  function sitesHTML() {
    var list = by(sites()).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var actifs = list.filter(function (x) { return x.statut === "actif"; }).length;
    var refonte = list.filter(function (x) { return x.type === "refonte"; }).length;
    var rows = list.map(function (s) {
      var cl = findClient(s.clientId);
      var exp = s.domaineExpiry && s.domaineExpiry < GW.today() ? " ⚠" : "";
      return [esc(s.url || s.domaine || "—"), cl ? esc(clientLabel(cl)) : "—", esc(s.type || "—"),
        GW.badge((SSTAT[s.statut] || [s.statut || "—"])[0], (SSTAT[s.statut] || ["", "grey"])[1]),
        (s.domaineExpiry ? dateF(s.domaineExpiry) + exp : "—"), s.gmb ? "Oui" : "—",
        "<button class='mini-btn' data-edit='" + s.id + "'>Modifier</button><button class='mini-btn danger' data-del='" + s.id + "'>✕</button>"];
    });
    tbS = [{ action: "new", label: "＋ Nouveau site", fn: function () { sView = { mode: "form", id: null }; GW.render(); } }];
    return "<div class='ws-kpis'>" +
      GW.kpi("Sites suivis", String(list.length), actifs + " actifs") +
      GW.kpi("Refontes", String(refonte), "projets") +
      GW.kpi("Google Business", String(list.filter(function (x) { return x.gmb; }).length), "optimisés") +
      "</div>" + GW.toolbar(tbS) +
      "<div class='ws-panel'><h3>🌐 Sites & SEO</h3>" +
      GW.tableHTML(["Site", "Client", "Type", "Statut", "Domaine jusqu'au", "GBP", "Actions"], rows, "Aucun site suivi.") + "</div>";
  }
  function sitesForm(id) {
    var s = id ? sites().filter(function (x) { return x.id === id; })[0] : null;
    return "<div class='ws-panel'><h3>" + (s ? "Modifier le site" : "Nouveau site") + "</h3><form id='st-form' class='ws-form'>" +
      GW.formRow("URL / nom", GW.input("url", s ? s.url : "", "Ex : monsite.fr")) +
      GW.formRow("Client", GW.select("clientId", [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; })), s ? (s.clientId || "") : (cid() || ""))) +
      GW.formRow("Type", GW.select("type", ["site vitrine", "e-commerce", "refonte", "landing", "autre"], s ? s.type : "site vitrine")) +
      GW.formRow("Statut", GW.select("statut", ["en_cours", "livre", "actif", "archive"], s ? s.statut : "en_cours")) +
      GW.formRow("Nom de domaine jusqu'au", GW.input("domaineExpiry", s ? s.domaineExpiry : "", "", "type='date'")) +
      GW.formRow("Google Business optimisé", GW.select("gmb", [{ v: "", l: "Non" }, { v: "1", l: "Oui" }], s && s.gmb ? "1" : "")) +
      GW.formRow("Notes SEO", GW.textarea("notes", s ? s.notes : "", "Mots-clés, position, actions…", 3)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }
  function bindSites() {
    if (sView.mode === "form") {
      var f = $("#st-form"); if (!f) return;
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var list = sites();
        var data = { url: f.url.value.trim(), clientId: f.clientId.value || null, type: f.type.value, statut: f.statut.value, domaineExpiry: f.domaineExpiry.value || "", gmb: f.gmb.value === "1", notes: f.notes.value.trim() };
        if (!data.url) { GW.toast("Indiquez l'URL ou le nom du site"); return; }
        if (sView.id) list = list.map(function (x) { return x.id === sView.id ? Object.assign({}, x, data) : x; });
        else { data.id = GW.uid(); data.date = GW.today(); list = list.concat([data]); }
        saveSites(list); GW.toast("Site enregistré"); sView = { mode: "list", id: null }; GW.render();
      });
      $("[data-back]", main()).addEventListener("click", function () { sView = { mode: "list", id: null }; GW.render(); });
      return;
    }
    GW.bindToolbar(tbS);
    $$("[data-edit]", main()).forEach(function (b) { b.addEventListener("click", function () { sView = { mode: "form", id: b.getAttribute("data-edit") }; GW.render(); }); });
    $$("[data-del]", main()).forEach(function (b) { b.addEventListener("click", function () { if (!confirm("Supprimer ce site ?")) return; saveSites(sites().filter(function (x) { return x.id !== b.getAttribute("data-del"); })); GW.toast("Site supprimé"); GW.render(); }); });
  }
  GW.register({ id: "sites", cat: "Services numériques", name: "Sites & SEO", icon: "🌐", tag: "Sites · domaine · référencement",
    render: function () { return sView.mode === "form" ? sitesForm(sView.id) : sitesHTML(); }, afterRender: bindSites });

  /* ==================================================================
     MODULE : APPELS D'OFFRES
     ================================================================== */
  var ASTAT = { repere: ["Repéré", "grey"], etude: ["À l'étude", "warn"], dossier: ["Dossier en cours", "warn"], depose: ["Déposé", "ok"], gagne: ["Gagné", "ok"], perdu: ["Perdu", "danger"] };
  var aView = { mode: "list", id: null };
  var tbA = [];
  function aos() { return GW.get("ga_ao"); }
  function saveAos(l) { GW.put("ga_ao", l); }
  function aosHTML() {
    var list = by(aos()).slice().sort(function (a, b) { return (a.dateLimite || "9999").localeCompare(b.dateLimite || "9999"); });
    var enCours = list.filter(function (x) { return ["repere", "etude", "dossier"].indexOf(x.statut) !== -1; }).length;
    var potentiel = list.filter(function (x) { return x.statut !== "perdu" && x.statut !== "gagne"; }).reduce(function (s, x) { return s + (Number(x.montant) || 0); }, 0);
    var rows = list.map(function (a) {
      var late = a.dateLimite && a.dateLimite < GW.today() && ["gagne", "perdu"].indexOf(a.statut) === -1;
      return [esc(a.intitule || "—"), esc(a.acheteur || "—"), (a.dateLimite ? dateF(a.dateLimite) + (late ? " ⚠" : "") : "—"),
        a.montant ? money(a.montant) : "—", GW.badge((ASTAT[a.statut] || [a.statut || "—"])[0], (ASTAT[a.statut] || ["", "grey"])[1]),
        "<button class='mini-btn' data-edit='" + a.id + "'>Modifier</button><button class='mini-btn danger' data-del='" + a.id + "'>✕</button>"];
    });
    tbA = [{ action: "new", label: "＋ Nouvel appel d'offres", fn: function () { aView = { mode: "form", id: null }; GW.render(); } }];
    return "<div class='ws-kpis'>" +
      GW.kpi("En cours", String(enCours), list.length + " suivis") +
      GW.kpi("Montant potentiel", money(potentiel), "hors gagnés/perdus") +
      GW.kpi("Déposés", String(list.filter(function (x) { return x.statut === "depose"; }).length), "à décision") +
      "</div>" + GW.toolbar(tbA) +
      "<div class='ws-panel'><h3>📑 Appels d'offres & marchés</h3>" +
      GW.tableHTML(["Intitulé", "Acheteur", "Date limite", "Montant", "Statut", "Actions"], rows, "Aucun appel d'offres suivi.") + "</div>";
  }
  function aosForm(id) {
    var a = id ? aos().filter(function (x) { return x.id === id; })[0] : null;
    return "<div class='ws-panel'><h3>" + (a ? "Modifier" : "Nouvel appel d'offres") + "</h3><form id='ao-form' class='ws-form'>" +
      GW.formRow("Intitulé", GW.input("intitule", a ? a.intitule : "", "Objet du marché")) +
      GW.formRow("Acheteur / donneur d'ordre", GW.input("acheteur", a ? a.acheteur : "", "Collectivité, entreprise…")) +
      GW.formRow("Date limite", GW.input("dateLimite", a ? a.dateLimite : "", "", "type='date'")) +
      GW.formRow("Montant estimé (€)", GW.money("montant", a ? a.montant : "")) +
      GW.formRow("Statut", GW.select("statut", ["repere", "etude", "dossier", "depose", "gagne", "perdu"], a ? a.statut : "repere")) +
      GW.formRow("Notes", GW.textarea("notes", a ? a.notes : "", "Exigences, contact…", 3)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }
  function bindAos() {
    if (aView.mode === "form") {
      var f = $("#ao-form"); if (!f) return;
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var list = aos();
        var data = { intitule: f.intitule.value.trim(), acheteur: f.acheteur.value.trim(), dateLimite: f.dateLimite.value || "", montant: Number(f.montant.value) || 0, statut: f.statut.value, notes: f.notes.value.trim() };
        if (!data.intitule) { GW.toast("Indiquez l'intitulé"); return; }
        if (aView.id) list = list.map(function (x) { return x.id === aView.id ? Object.assign({}, x, data) : x; });
        else { data.id = GW.uid(); data.date = GW.today(); list = list.concat([data]); }
        saveAos(list); GW.toast("Appel d'offres enregistré"); aView = { mode: "list", id: null }; GW.render();
      });
      $("[data-back]", main()).addEventListener("click", function () { aView = { mode: "list", id: null }; GW.render(); });
      return;
    }
    GW.bindToolbar(tbA);
    $$("[data-edit]", main()).forEach(function (b) { b.addEventListener("click", function () { aView = { mode: "form", id: b.getAttribute("data-edit") }; GW.render(); }); });
    $$("[data-del]", main()).forEach(function (b) { b.addEventListener("click", function () { if (!confirm("Supprimer cet appel d'offres ?")) return; saveAos(aos().filter(function (x) { return x.id !== b.getAttribute("data-del"); })); GW.toast("Supprimé"); GW.render(); }); });
  }
  GW.register({ id: "appels_offres", cat: "Services numériques", name: "Appels d'offres", icon: "📑", tag: "Marchés publics · suivi",
    render: function () { return aView.mode === "form" ? aosForm(aView.id) : aosHTML(); }, afterRender: bindAos });

  /* ==================================================================
     MODULE : CONTRATS  (compatible app.js : num, titre, montant, statut)
     ================================================================== */
  var CSTAT = { actif: ["Actif", "ok"], en_attente: ["En attente", "warn"], termine: ["Terminé", "grey"] };
  var cView = { mode: "list", id: null };
  var tbC = [];
  function contrats() { return GW.get("ga_contrats"); }
  function saveContrats(l) { GW.put("ga_contrats", l); }
  function cNum() {
    var yr = new Date().getFullYear();
    return "CT-" + yr + "-" + String(contrats().length + 1).padStart(3, "0");
  }
  function contratsHTML() {
    var list = by(contrats());
    var actifs = list.filter(function (x) { return x.statut === "actif"; });
    var mrr = actifs.reduce(function (s, x) { return s + (Number(x.montant) || 0); }, 0);
    var rows = list.map(function (c) {
      var cl = findClient(c.clientId);
      return [esc(c.num || "—"), esc(c.titre || "—"), cl ? esc(clientLabel(cl)) : "—", money(c.montant),
        GW.badge((CSTAT[c.statut] || [c.statut || "—"])[0], (CSTAT[c.statut] || ["", "grey"])[1]),
        (c.dateFin ? dateF(c.dateFin) : "—"),
        "<button class='mini-btn' data-edit='" + c.id + "'>Modifier</button><button class='mini-btn danger' data-del='" + c.id + "'>✕</button>"];
    });
    tbC = [{ action: "new", label: "＋ Nouveau contrat", fn: function () { cView = { mode: "form", id: null }; GW.render(); } }];
    return "<div class='ws-kpis'>" +
      GW.kpi("Contrats actifs", String(actifs.length), list.length + " au total") +
      GW.kpi("Revenu récurrent", money(mrr), "contrats actifs") +
      "</div>" + GW.toolbar(tbC) +
      "<div class='ws-panel'><h3>📜 Contrats</h3>" +
      GW.tableHTML(["N°", "Titre", "Client", "Montant", "Statut", "Fin", "Actions"], rows, "Aucun contrat.") + "</div>";
  }
  function contratsForm(id) {
    var c = id ? contrats().filter(function (x) { return x.id === id; })[0] : null;
    return "<div class='ws-panel'><h3>" + (c ? "Modifier le contrat " + esc(c.num) : "Nouveau contrat") + "</h3><form id='ct-form' class='ws-form'>" +
      GW.formRow("Titre", GW.input("titre", c ? c.titre : "", "Ex : Maintenance annuelle")) +
      GW.formRow("Client", GW.select("clientId", [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (x) { return { v: x.id, l: clientLabel(x) }; })), c ? (c.clientId || "") : (cid() || ""))) +
      GW.formRow("Montant (€)", GW.money("montant", c ? c.montant : "")) +
      GW.formRow("Statut", GW.select("statut", ["actif", "en_attente", "termine"], c ? c.statut : "actif")) +
      GW.formRow("Début", GW.input("dateDebut", c ? c.dateDebut : "", "", "type='date'")) +
      GW.formRow("Fin", GW.input("dateFin", c ? c.dateFin : "", "", "type='date'")) +
      GW.formRow("Notes", GW.textarea("notes", c ? c.notes : "", "Clauses, périmètre…", 3)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }
  function bindContrats() {
    if (cView.mode === "form") {
      var f = $("#ct-form"); if (!f) return;
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var list = contrats();
        var data = { titre: f.titre.value.trim(), clientId: f.clientId.value || null, montant: Number(f.montant.value) || 0, statut: f.statut.value, dateDebut: f.dateDebut.value || "", dateFin: f.dateFin.value || "", notes: f.notes.value.trim() };
        if (!data.titre) { GW.toast("Titre requis"); return; }
        if (cView.id) list = list.map(function (x) { return x.id === cView.id ? Object.assign({}, x, data) : x; });
        else { data.id = GW.uid(); data.num = cNum(); list = list.concat([data]); }
        saveContrats(list); GW.toast("Contrat enregistré"); cView = { mode: "list", id: null }; GW.render();
      });
      $("[data-back]", main()).addEventListener("click", function () { cView = { mode: "list", id: null }; GW.render(); });
      return;
    }
    GW.bindToolbar(tbC);
    $$("[data-edit]", main()).forEach(function (b) { b.addEventListener("click", function () { cView = { mode: "form", id: b.getAttribute("data-edit") }; GW.render(); }); });
    $$("[data-del]", main()).forEach(function (b) { b.addEventListener("click", function () { if (!confirm("Supprimer ce contrat ?")) return; saveContrats(contrats().filter(function (x) { return x.id !== b.getAttribute("data-del"); })); GW.toast("Contrat supprimé"); GW.render(); }); });
  }
  GW.register({ id: "contrats", cat: "Services numériques", name: "Contrats", icon: "📜", tag: "Contrats clients",
    render: function () { return cView.mode === "form" ? contratsForm(cView.id) : contratsHTML(); }, afterRender: bindContrats });

}(window.GestWorkspace));
