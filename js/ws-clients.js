/* ============================================================
   GestAffaires – MODULE « CLIENTS »
   Nouveau client : fiche complète + pièces jointes chiffrées
   Création automatique d'un dossier client TRIÉ, relié à chaque outil.
   Rubrique « Messages & réseaux » isolée (ne se mélange pas aux infos).
   ============================================================ */

(function (GW) {
  "use strict";

  var view = { mode: "list", clientId: null }; // list | new | dossier | edit
  var tabId = "infos";
  var piecesCache = null;

  var FORMULES = ["Gestion administrative", "Secrétariat téléphonique", "Site Internet", "Google Business", "Réseaux sociaux", "Google Ads", "Formule complète", "Autre"];
  var SOURCES = ["Google", "Google Ads", "Facebook", "Instagram", "Bouche-à-oreille", "Salon / réseau", "Mail", "Autre"];
  var RESEAUX = ["Instagram", "Facebook", "LinkedIn", "TikTok", "Google Business", "WhatsApp", "Site web", "Autre"];

  var STATUT_F = { brouillon: "Brouillon", en_attente: "En attente", payee: "Payée", annulee: "Annulée" };
  var STATUT_D = { brouillon: "Brouillon", envoye: "Envoyé", refuse: "Refusé", accepte: "Accepté" };
  var STATUT_C = { actif: "Actif", termine: "Terminé", resilie: "Résilié" };
  var STATUT_E = { fait: "Réglé", en_attente: "À régler" };
  var STATUT_P = { attente: "À publier", publie: "Publié", refuse: "Refusé" };

  function esc(s) { return GW.esc(s); }
  function fmtMoney(n) { return GW.fmtMoney(n); }
  function fmtDate(iso) { return GW.fmtDate(iso); }
  function kpi(l, v, s, k) { return GW.kpi(l, v, s, k); }
  function empty(m) { return GW.empty(m || "Aucune donnée pour ce client."); }
  function fmtBytes(n) {
    if (!n) return "0 o";
    if (n < 1024) return n + " o";
    if (n < 1048576) return (n / 1024).toFixed(1) + " Ko";
    return (n / 1048576).toFixed(1) + " Mo";
  }
  function localRows(key, clientId) {
    return GW.get(key).filter(function (x) { return !clientId || x.clientId === clientId; });
  }
  function totalFor(list) {
    return list.reduce(function (s, x) { return s + GW.docTotals(x.lignes).ttc; }, 0);
  }
  function clientById(id) { return GW.findClient(id); }

  GW.openClientNew = function () { view = { mode: "new", clientId: null }; GW.openModule("clients"); };
  GW.openClientDossier = function (id) { view = { mode: "dossier", clientId: id }; GW.setClient(id); GW.openModule("clients"); };

  /* ------------------------------------------------------------------
     MODULE
     ------------------------------------------------------------------ */
  GW.register({
    id: "clients",
    cat: "Centre de pilotage",
    name: "Clients",
    tag: "Nouveau client · Dossier client trié",
    icon: "🗂️",
    render: function () {
      if (view.mode === "new" || view.mode === "edit") return renderNew();
      if (view.mode === "dossier" && view.clientId) return renderDossier(view.clientId);
      return renderList();
    },
    afterRender: function () {
      if (view.mode === "new" || view.mode === "edit") bindNew();
      else if (view.mode === "dossier" && view.clientId) bindDossier(view.clientId);
      else bindList();
    }
  });

  /* ------------------- LISTE ------------------- */
  function refreshPiecesCache() {
    piecesCache = null;
    if (!(GW.files && GW.files.list)) return;
    GW.files.list(null).then(function (l) {
      piecesCache = {};
      l.forEach(function (f) { piecesCache[f.clientId] = (piecesCache[f.clientId] || 0) + 1; });
      GW.render();
    }).catch(function () {});
  }
  function renderList() {
    var clients = GW.getClients();
    var incomplete = clients.filter(function (c) { return !c.formule || !c.siret; }).length;
    if (piecesCache === null) refreshPiecesCache();
    var kp = "<div class='ws-kpis'>" +
      kpi("Clients", clients.length, "dossiers ouverts") +
      kpi("Pièces stockées", (function () { var s = 0; for (var k in (piecesCache || {})) s += piecesCache[k]; return s || "…"; })(), "coffre chiffré") +
      kpi("Fiches incomplètes", incomplete, "infos manquantes", incomplete ? "warn" : "") +
      "</div>";
    var rows2 = clients.map(function (c) {
      var fs = localRows("ga_factures", c.id), fttc = totalFor(fs);
      return [
        "<b>" + esc(c.name || c.company || "Sans nom") + "</b>" + (c.formule ? "<br><span class='ws-hint'>" + esc(c.formule) + "</span>" : ""),
        (c.phone ? esc(c.phone) + "<br>" : "") + (c.email ? esc(c.email) : "—"),
        esc(c.source || "—"),
        fmtDate(c.entree) || "—",
        fmtMoney(fttc) + " <span class='ws-hint'>(" + fs.length + ")</span>",
        piecesCache && piecesCache[c.id] != null ? piecesCache[c.id] : "…",
        (c.formule && c.siret) ? GW.badge("Complet", "ok") : GW.badge("Incomplet", "warn"),
        "<div class='ws-actions'><button class='mini-btn' data-dossier='" + c.id + "'>📂 Dossier</button><button class='mini-btn' data-edit='" + c.id + "'>✏️</button></div>"
      ];
    });
    return kp +
      "<div class='ws-panel'><h3>Clients &amp; dossiers</h3>" +
      "<div class='ws-actions' style='margin-bottom:12px;'><button class='admin-btn primary' data-new-client>＋ Nouveau client</button></div>" +
      (rows2.length
        ? GW.tableHTML(["Client", "Contact", "Source", "Depuis", "Facturé", "Pièces", "Dossier", ""], rows2, "Aucun client.")
        : empty("Aucun client pour le moment. Cliquez sur « ＋ Nouveau client » pour ouvrir un dossier complet.")) +
      "</div>";
  }
  function bindList() {
    var b = document.querySelector("[data-new-client]");
    if (b) b.addEventListener("click", function () { view = { mode: "new", clientId: null }; GW.render(); });
    document.querySelectorAll("[data-dossier]").forEach(function (a) {
      a.addEventListener("click", function () { GW.openClientDossier(a.getAttribute("data-dossier")); });
    });
    document.querySelectorAll("[data-edit]").forEach(function (a) {
      a.addEventListener("click", function () { view = { mode: "edit", clientId: a.getAttribute("data-edit") }; GW.render(); });
    });
  }

  /* ------------------- NOUVEAU / EDIT ------------------- */
  function renderNew() {
    var isEdit = view.mode === "edit";
    var c = isEdit ? clientById(view.clientId) : null;
    function v(k, d) { var val = c ? c[k] : null; return val != null && val !== "" ? val : (d || ""); }
    function socialRows() {
      var list = (c && c.socials && c.socials.length ? c.socials : [{ label: "Instagram", url: "" }, { label: "Facebook", url: "" }]);
      return list.map(function (s, i) {
        return "<div class='ws-frow ws-socrow'><label>Compte #" + (i + 1) + "</label><div style='display:flex;gap:8px;flex-wrap:wrap;width:100%;'>" +
          "<select name='soc_label_" + i + "' style='min-width:150px;'>" + RESEAUX.map(function (r) { return "<option" + (s.label === r ? " selected" : "") + ">" + r + "</option>"; }).join("") + "</select>" +
          "<input name='soc_url_" + i + "' value='" + esc(s.url || "") + "' placeholder='https://…' style='flex:1;min-width:180px;'></div></div>";
      }).join("");
    }
    return "<div class='ws-panel'>" +
      "<h3>" + (isEdit ? "✏️ Modifier le client" : "＋ Nouveau client") + "</h3>" +
      "<p class='ws-hint'>Ces informations alimentent le dossier client, automatiquement trié et relié à chaque outil de l'espace de travail.</p>" +
      "<div class='ws-form'>" +
      GW.formRow("Entreprise / raison sociale", GW.input("c_company", v("company"), "Ex : Boulangerie du Centre")) +
      GW.formRow("Nom du contact", GW.input("c_name", v("name"), "Nom et prénom")) +
      GW.formRow("Téléphone", GW.input("c_phone", v("phone"), "06 12 34 56 78")) +
      GW.formRow("E-mail", GW.input("c_email", v("email"), "client@exemple.fr")) +
      GW.formRow("Adresse", GW.input("c_address", v("address"), "Adresse complète")) +
      GW.formRow("SIRET", GW.input("c_siret", v("siret"), "123 456 789 00012")) +
      GW.formRow("Secteur d'activité", GW.input("c_secteur", v("secteur"), "Boulangerie, artisanat, services…")) +
      GW.formRow("Formule / offre", GW.select("c_formule", FORMULES, v("formule"))) +
      GW.formRow("Source d'acquisition", GW.select("c_source", SOURCES, v("source"))) +
      GW.formRow("Date d'entrée", GW.input("c_entree", v("entree", GW.today()), "AAAA-MM-JJ", "type='date'")) +
      GW.formRow("Notes", GW.textarea("c_notes", v("notes"), "Détails, consignes, historique…", 3)) +
      "</div>" +
      "<div class='ws-panel ws-panel-sub'><h4>📨 Messages &amp; réseaux</h4>" +
      "<p class='ws-hint'>Comptes et liens du client, rangés dans un dossier séparé (pas mélangés aux informations).</p>" +
      "<div id='ws-socials'>" + socialRows() + "</div>" +
      "<button type='button' class='mini-btn' data-add-soc>＋ Ajouter un compte</button></div>" +
      "<div class='ws-panel ws-panel-sub'><h4>📎 Pièces jointes</h4>" +
      "<p class='ws-hint'>KBis, CGV, devis, logo, contrats signés… Stockés chiffrés (coffre). Déverrouillez le coffre avant d'enregistrer pour joindre ces fichiers.</p>" +
      "<input type='file' multiple data-files style='max-width:420px;'></div>" +
      "<div class='ws-actions'>" +
      "<button class='admin-btn' data-back>Annuler</button>" +
      "<button class='admin-btn primary' data-save-new>💾 " + (isEdit ? "Enregistrer les modifications" : "Créer le client et le dossier") + "</button>" +
      "</div><div id='new-msg'></div></div>";
  }
  function msg(html) {
    var el = document.getElementById("new-msg");
    if (el) el.innerHTML = "<p class='ws-hint' style='color:#b3423a;'>" + html + "</p>";
  }
  function bindNew() {
    var back = document.querySelector("[data-back]");
    if (back) back.addEventListener("click", function () { view = { mode: "list", clientId: null }; GW.render(); });
    var addSoc = document.querySelector("[data-add-soc]");
    if (addSoc) addSoc.addEventListener("click", function () {
      var i = document.querySelectorAll(".ws-socrow").length;
      var div = document.createElement("div");
      div.className = "ws-frow ws-socrow";
      div.innerHTML = "<label>Compte #" + (i + 1) + "</label><div style='display:flex;gap:8px;flex-wrap:wrap;width:100%;'>" +
        "<select name='soc_label_" + i + "' style='min-width:150px;'>" + RESEAUX.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select>" +
        "<input name='soc_url_" + i + "' placeholder='https://…' style='flex:1;min-width:180px;'></div>";
      document.getElementById("ws-socials").appendChild(div);
    });
    var save = document.querySelector("[data-save-new]");
    if (save) save.addEventListener("click", function () {
      var isEdit = view.mode === "edit";
      var g = function (n) { var el = document.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
      var socials = [];
      var sels = document.querySelectorAll("[name^='soc_label_']");
      var urls = document.querySelectorAll("[name^='soc_url_']");
      for (var i = 0; i < sels.length; i++) {
        if (urls[i] && urls[i].value.trim()) socials.push({ label: sels[i].value, url: urls[i].value.trim() });
      }
      if (!g("c_name") && !g("c_company")) { GW.toast("Nom ou entreprise requis"); msg("⚠️ Indiquez le nom du contact ou l'entreprise."); return; }
      var entries = {
        company: g("c_company"), name: g("c_name"), phone: g("c_phone"), email: g("c_email"),
        address: g("c_address"), siret: g("c_siret"), secteur: g("c_secteur"),
        formule: g("c_formule"), source: g("c_source"), entree: g("c_entree") || GW.today(),
        notes: g("c_notes"), socials: socials
      };
      var list = GW.getClients();
      var id = isEdit ? view.clientId : GW.uid();
      if (!isEdit) {
        entries.id = id; entries.statut = "nouveau"; entries.created = new Date().toISOString();
        list.push(entries);
      } else {
        var old = list.filter(function (x) { return x.id === id; })[0] || {};
        var merged = {};
        Object.keys(old).forEach(function (k) { merged[k] = old[k]; });
        Object.keys(entries).forEach(function (k) { merged[k] = entries[k]; });
        merged.id = id;
        list = list.map(function (x) { return x.id === id ? merged : x; });
      }
      GW.put("ga_clients", list);
      var filesEl = document.querySelector("[data-files]");
      var seq = Array.prototype.slice.call((filesEl && filesEl.files) || []);
      var step = 0;
      var skipped = 0;
      function finish() {
        GW.toast(isEdit ? "Client modifié" : "Client créé — dossier ouvert");
        if (skipped) GW.toast(skipped + " pièce(s) non stockée(s) : déverrouillez le coffre.");
        GW.openClientDossier(id);
        GW.render();
      }
      function uploadOne() {
        if (step >= seq.length) { finish(); return; }
        GW.files.add(id, seq[step]).then(function () {
          step++; uploadOne();
        }).catch(function () {
          skipped++; step++; uploadOne();
        });
      }
      if (!seq.length) finish(); else uploadOne();
    });
  }

  /* ------------------- DOSSIER ------------------- */
  function tabsHTML(id) {
    var tabs = [
      { id: "infos", l: "Infos & pièces" },
      { id: "messages", l: "📨 Messages & réseaux" },
      { id: "factures", l: "Factures" },
      { id: "devis", l: "Devis" },
      { id: "contrats", l: "Contrats" },
      { id: "com", l: "Communication" },
      { id: "tel", l: "Téléphonie" },
      { id: "compta", l: "Compta" },
      { id: "report", l: "Reporting" }
    ];
    return "<nav class='ws-subnav'>" + tabs.map(function (t) {
      return "<button type='button' class='ws-subtab" + (tabId === t.id ? " active" : "") + "' data-tab='" + t.id + "'>" + t.l + "</button>";
    }).join("") + "</nav>";
  }
  function renderDossier(id) {
    var c = clientById(id);
    if (!c) { view = { mode: "list", clientId: null }; return renderList(); }
    var chips = "";
    if (c.formule) chips += GW.badge(c.formule, "ok");
    if (c.source) chips += GW.badge("Source : " + c.source);
    if (c.siret) chips += GW.badge(c.siret);
    else if (c.formule) chips += GW.badge("SIRET manquant", "warn");
    var head = "<div class='ws-panel'><div class='ws-dhead'>" +
      "<div style='flex:1;'><h3 style='margin:0 0 4px;'>📂 Dossier · " + esc(c.name || c.company || "Sans nom") + "</h3>" +
      (c.company && c.company !== c.name ? "<div class='ws-hint'>" + esc(c.company) + "</div>" : "") +
      "<div style='margin:6px 0;'>" + chips + "</div></div>" +
      "<div class='ws-actions'><button class='mini-btn' data-edit='" + c.id + "'>✏️ Modifier</button>" +
      "<button class='mini-btn' data-print>🖨️ Fiche</button>" +
      "<button class='mini-btn' data-back>← Liste</button></div></div></div>" +
      tabsHTML(id);
    var content = tabContent(tabId, c);
    return head + "<div class='ws-mod-body'>" + content + "</div>";
  }
  function tabContent(t, c) {
    switch (t) {
      case "infos": return tabInfos(c);
      case "messages": return tabMessages(c);
      case "factures": return tabFactures(c);
      case "devis": return tabDevis(c);
      case "contrats": return tabContrats(c);
      case "com": return tabCom(c);
      case "tel": return tabTel(c);
      case "compta": return tabCompta(c);
      case "report": return tabReport(c);
    }
    return "";
  }

  function tabInfos(c) {
    var vs = (GW.vault && GW.vault.status) ? GW.vault.status() : { unlocked: false };
    var lockRow = vs.unlocked
      ? "<p class='ws-hint' style='color:#0b7a46;'>🔓 Coffre déverrouillé — pièces stockées chiffrées, jamais transmises.</p>"
      : "<div class='ws-lockbox'><p><b>🔒 Coffre verrouillé.</b> Déverrouillez pour stocker / lire les pièces jointes.</p>" +
        "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap;'>" +
        "<input type='password' id='vault-pass' placeholder='Phrase secrète' style='max-width:220px;'>" +
        "<button class='admin-btn' data-unlock>🔓 Déverrouiller</button>" +
        "<button class='admin-btn' data-new-vault>🔐 Créer le coffre</button></div></div>";
    return "<div class='ws-panel ws-panel-sub'><h4>Informations</h4>" +
      "<div class='ws-info-grid'>" +
      "<div><span>Contact</span>" + esc(c.name || "—") + "</div>" +
      "<div><span>Téléphone</span>" + esc(c.phone || "—") + "</div>" +
      "<div><span>E-mail</span>" + esc(c.email || "—") + "</div>" +
      "<div><span>Adresse</span>" + esc(c.address || "—") + "</div>" +
      "<div><span>SIRET</span>" + esc(c.siret || "—") + "</div>" +
      "<div><span>Secteur</span>" + esc(c.secteur || "—") + "</div>" +
      "<div><span>Formule</span>" + esc(c.formule || "—") + "</div>" +
      "<div><span>Source</span>" + esc(c.source || "—") + "</div>" +
      "<div><span>Depuis le</span>" + fmtDate(c.entree) + "</div>" +
      "<div class='ws-info-full'><span>Notes</span>" + esc(c.notes || "—") + "</div>" +
      "</div></div>" +
      "<div class='ws-panel ws-panel-sub'><h4>📎 Pièces jointes</h4>" + lockRow +
      "<div id='pieces-list'><p class='ws-hint'>Chargement…</p></div>" +
      (vs.unlocked ? "<div style='margin-top:10px;'><input type='file' multiple data-add-piece style='max-width:420px;'><span class='ws-hint' id='pieces-msg'></span></div>" : "") +
      "</div>";
  }
  function tabMessages(c) {
    var socials = (c.socials && c.socials.length) ? c.socials : [];
    var rows = socials.length
      ? socials.map(function (s) { return "<span class='ws-pill'>" + esc(s.label) + "</span> <a href='" + esc(s.url) + "' target='_blank' rel='noopener'>" + esc(s.url) + "</a>"; }).join("<br>")
      : "";
    var pubs = localRows("ga_planif", c.id).map(function (p) {
      return [fmtDate(p.date), esc(p.canal || "—"), esc((p.contenu || "").substring(0, 90)) + ((p.contenu || "").length > 90 ? "…" : ""), GW.badge(STATUT_P[p.statut] || p.statut || "—", p.statut === "publie" ? "ok" : "warn"), "<button class='mini-btn' data-open-tool='communication'>Ouvrir</button>"];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>📨 Messages &amp; réseaux</h4>" +
      "<p class='ws-hint'>Comptes du client et contenus planifiés — conservés à part, sans mélange avec les informations.</p>" +
      (rows ? "<p>" + rows + "</p>" : "<p>Aucun compte réseau renseigné — <button class='mini-btn' data-edit='" + c.id + "'>✏️ ajouter</button></p>") +
      "</div>" +
      "<div class='ws-panel ws-panel-sub'><h4>Publications planifiées</h4>" +
      (pubs.length ? GW.tableHTML(["Date", "Canal", "Contenu", "Statut", ""], pubs, "Aucune publication.") : empty("Aucune publication planifiée pour ce client.")) +
      "</div>";
  }
  function tabFactures(c) {
    var fs = localRows("ga_factures", c.id);
    var rows = fs.map(function (f) {
      return [esc(f.num || "—"), fmtDate(f.date), fmtDate(f.echeance) || "—", fmtMoney(GW.docTotals(f.lignes).ttc), GW.badge(STATUT_F[f.statut] || f.statut || "—", f.statut === "payee" ? "ok" : (f.statut === "en_attente" ? "warn" : "")), "<button class='mini-btn' data-open-tool='gestion'>Ouvrir</button>"];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>Factures</h4><p>Total facturé : <b>" + fmtMoney(totalFor(fs)) + "</b> · " + fs.length + " facture(s)</p>" +
      (rows.length ? GW.tableHTML(["N°", "Date", "Échéance", "Total TTC", "Statut", ""], rows, "Aucune facture.") : empty("Aucune facture pour ce client.")) + "</div>";
  }
  function tabDevis(c) {
    var ds = localRows("ga_devis", c.id);
    var rows = ds.map(function (d) {
      return [esc(d.num || "—"), fmtDate(d.date), fmtMoney(GW.docTotals(d.lignes).ttc), GW.badge(STATUT_D[d.statut] || d.statut || "—", d.statut === "accepte" ? "ok" : ""), "<button class='mini-btn' data-open-tool='gestion'>Ouvrir</button>"];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>Devis</h4><p>Total devis : <b>" + fmtMoney(totalFor(ds)) + "</b> · " + ds.length + " devis(s)</p>" +
      (rows.length ? GW.tableHTML(["N°", "Date", "Total TTC", "Statut", ""], rows, "Aucun devis.") : empty("Aucun devis pour ce client.")) + "</div>";
  }
  function tabContrats(c) {
    var cs = localRows("ga_contrats", c.id);
    var rows = cs.map(function (x) {
      return [esc(x.num || "—"), fmtDate(x.date) || "—", GW.badge(STATUT_C[x.statut] || x.statut || "—", x.statut === "actif" ? "ok" : ""), "<button class='mini-btn' data-open-tool='dossiers'>Ouvrir</button>"];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>Contrats</h4>" +
      (rows.length ? GW.tableHTML(["N°", "Début", "Statut", ""], rows, "Aucun contrat.") : empty("Aucun contrat pour ce client.")) + "</div>";
  }
  function tabCom(c) {
    var camps = localRows("ga_campagnes", c.id);
    var rows = camps.map(function (x) {
      return [esc(x.nom || "—"), esc(x.type || "—"), fmtMoney(x.montant), esc(x.statut || "—"), "<button class='mini-btn' data-open-tool='acquisition'>Ouvrir</button>"];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>Campagnes d'acquisition</h4>" +
      (rows.length ? GW.tableHTML(["Nom", "Type", "Budget", "Statut", ""], rows, "Aucune campagne.") : empty("Aucune campagne pour ce client.")) + "</div>";
  }
  function tabTel(c) {
    var appels = localRows("ga_appels", c.id).filter(function (a) { return a.statut !== "traite"; });
    var rdvs = localRows("ga_rdv", c.id);
    var linesA = appels.map(function (a) {
      return [fmtDate(a.date), esc(a.motif || "—"), esc(a.rappel || "—"), esc(a.statut || "—"), "<button class='mini-btn' data-open-tool='secretariat'>Ouvrir</button>"];
    });
    var linesR = rdvs.map(function (r) {
      return [fmtDate(r.date), esc(r.qui || "—"), esc(r.lieu || "—"), esc(r.notes || "—")];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>Appels en attente</h4>" +
      (linesA.length ? GW.tableHTML(["Date", "Motif", "Rappel", "Statut", ""], linesA, "Aucun appel.") : empty("Aucun appel pour ce client.")) +
      "</div><div class='ws-panel ws-panel-sub'><h4>Rendez-vous</h4>" +
      (linesR.length ? GW.tableHTML(["Date", "Qui", "Lieu", "Notes"], linesR, "Aucun rendez-vous.") : empty("Aucun rendez-vous pour ce client.")) + "</div>";
  }
  function tabCompta(c) {
    var echs = localRows("ga_echeances", c.id);
    var rows = echs.map(function (e) {
      return [fmtDate(e.date), esc(e.type || "—"), fmtMoney(e.montant), GW.badge(STATUT_E[e.statut] || e.statut || "—", e.statut === "fait" ? "ok" : "warn"), "<button class='mini-btn' data-open-tool='compta'>Ouvrir</button>"];
    });
    var dep = localRows("ga_depenses", c.id).reduce(function (s, x) { return s + (Number(x.ht) || 0) + (Number(x.tva) || 0); }, 0);
    return "<div class='ws-panel ws-panel-sub'><h4>Échéances &amp; déclarations</h4>" +
      (rows.length ? GW.tableHTML(["Date", "Type", "Montant", "Statut", ""], rows, "Aucune échéance.") : empty("Aucune échéance pour ce client.")) +
      "</div><div class='ws-panel ws-panel-sub'><p>Dépenses du client : <b>" + fmtMoney(dep) + "</b></p></div>";
  }
  function tabReport(c) {
    var hs = localRows("ga_heures", c.id);
    var hsum = hs.reduce(function (s, x) { return s + (Number(x.heures) || 0); }, 0);
    var montant = hs.reduce(function (s, x) { return s + (Number(x.montant) || 0); }, 0);
    var rows = hs.map(function (h) {
      return [fmtDate(h.date), (Number(h.heures) || 0).toFixed(1).replace(".", ",") + " h", esc(h.tache || "—"), fmtMoney(h.montant)];
    });
    return "<div class='ws-panel ws-panel-sub'><h4>Reporting (heures &amp; valeur)</h4><p>Heures : <b>" + (Number(hsum).toFixed ? hsum.toFixed(1) : hsum) + " h</b> · Valeur : <b>" + fmtMoney(montant) + "</b></p>" +
      (rows.length ? GW.tableHTML(["Date", "Heures", "Tâche", "Valeur"], rows, "Aucune heure saisie.") : empty("Aucune saisie de reporting pour ce client.")) + "</div>";
  }

  function bindDossier(id) {
    var c = clientById(id);
    if (!c) return;
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { tabId = b.getAttribute("data-tab"); GW.render(); });
    });
    document.querySelectorAll("[data-back]").forEach(function (b) {
      b.addEventListener("click", function () { view = { mode: "list", clientId: null }; GW.render(); });
    });
    document.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { view = { mode: "edit", clientId: b.getAttribute("data-edit") }; GW.render(); });
    });
    document.querySelectorAll("[data-open-tool]").forEach(function (b) {
      b.addEventListener("click", function () {
        GW.setClient(id);
        GW.openModule(b.getAttribute("data-open-tool"));
        view = { mode: "dossier", clientId: id };
      });
    });
    var prt = document.querySelector("[data-print]");
    if (prt) prt.addEventListener("click", function () {
      var socialTxt = (c.socials && c.socials.length) ? c.socials.map(function (s) { return s.label + " : " + s.url; }).join("<br>") : "—";
      var body = "<div class='ps-doc'><h1>" + esc(c.name || c.company || "Client") + "</h1>" +
        (c.company && c.company !== c.name ? "<p><b>" + esc(c.company) + "</b></p>" : "") +
        "<p>" + esc(c.phone || "") + " · " + esc(c.email || "") + "<br>" + esc(c.address || "") + "</p>" +
        "<p>SIRET : " + esc(c.siret || "—") + "<br>Secteur : " + esc(c.secteur || "—") + "<br>Formule : " + esc(c.formule || "—") + "<br>Source : " + esc(c.source || "—") + "<br>Depuis le : " + fmtDate(c.entree) + "</p>" +
        "<h3>Notes</h3><p>" + esc(c.notes || "—") + "</p>" +
        "<h3>Messages &amp; réseaux</h3><p>" + socialTxt + "</p>" +
        "</div>";
      GW.printHTML("Fiche client · " + (c.name || c.company || "Client"), body);
    });
    var uk = document.querySelector("[data-unlock]");
    if (uk) uk.addEventListener("click", function () {
      var pass = document.getElementById("vault-pass");
      if (!pass || !pass.value) { GW.toast("Saisissez la phrase secrète"); return; }
      GW.vault.unlock(pass.value).then(function () { GW.toast("Coffre déverrouillé"); GW.render(); })
        .catch(function (e) { GW.toast(e.message); });
    });
    var nv = document.querySelector("[data-new-vault]");
    if (nv) nv.addEventListener("click", function () {
      var pass = document.getElementById("vault-pass");
      if (!pass || pass.value.length < 8) { GW.toast("Phrase secrète : 8 caractères minimum"); return; }
      GW.vault.init(pass.value).then(function () { GW.toast("Coffre créé et déverrouillé"); GW.render(); })
        .catch(function (e) { GW.toast(e.message); });
    });
    refreshPieces(id);
    var addPiece = document.querySelector("[data-add-piece]");
    if (addPiece) addPiece.addEventListener("change", function () {
      var f = addPiece.files;
      if (!f || !f.length) return;
      var msgEl = document.getElementById("pieces-msg");
      var i = 0;
      function add() {
        if (i >= f.length) { GW.toast("Pièces stockées"); refreshPieces(id); return; }
        GW.files.add(id, f[i]).then(function () { i++; if (msgEl) msgEl.textContent = "Stockage… " + i + "/" + f.length; add(); })
          .catch(function (e) { GW.toast(e.message); i++; add(); });
      }
      add();
    });
  }

  function refreshPieces(id) {
    var box = document.getElementById("pieces-list");
    if (!box) return;
    if (!(GW.files && GW.files.list)) { box.innerHTML = "<p class='ws-hint'>Stockage indisponible (IndexedDB/WebCrypto).</p>"; return; }
    GW.files.list(id).then(function (l) {
      if (!l.length) { box.innerHTML = "<p class='ws-hint'>Aucune pièce jointe pour ce client.</p>"; return; }
      box.innerHTML = "<div class='ws-table-wrap'><table class='ws-table'><thead><tr><th>Nom</th><th>Taille</th><th>Ajouté</th><th></th></tr></thead><tbody>" +
        l.map(function (f) {
          return "<tr><td>" + esc(f.name) + "</td><td>" + fmtBytes(f.size) + "</td><td>" + fmtDate(new Date(f.ts).toISOString().split("T")[0]) + "</td>" +
            "<td><div class='ws-actions'><button class='mini-btn' data-dl='" + f.id + "'>⬇️ Télécharger</button><button class='mini-btn' data-del='" + f.id + "'>🗑️</button></div></td></tr>";
        }).join("") + "</tbody></table></div>";
      box.querySelectorAll("[data-dl]").forEach(function (b) {
        b.addEventListener("click", function () {
          GW.files.open(b.getAttribute("data-dl")).then(function (r) {
            if (!r) { GW.toast("Pièce introuvable"); return; }
            var a = document.createElement("a");
            a.href = URL.createObjectURL(r.blob);
            a.download = r.name;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 400);
          }).catch(function (e) { GW.toast(e.message); });
        });
      });
      box.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("Supprimer cette pièce ?")) return;
          GW.files.remove(b.getAttribute("data-del")).then(function () { refreshPieces(id); GW.toast("Pièce supprimée"); });
        });
      });
    }).catch(function (e) { box.innerHTML = "<p class='ws-hint'>" + esc(e.message) + "</p>"; });
  }

}(window.GestWorkspace));