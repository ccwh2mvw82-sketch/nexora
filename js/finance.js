/* ============================================================
   GestAffaires – « Espace de travail + » · PHASE 4
   Suivi commercial & financier
   - FACTURATION : devis & factures, TVA par ligne, conversion
     devis -> facture en 1 clic, paiement Stripe, échéances.
   - TEMPS & FORFAITS : temps passé, valeur, forfaits mensuels.
   Clés (compatibles avec l'existant) : ga_devis, ga_factures,
   ga_heures, ga_factures. Aucune donnée existante n'est écrasée.
   ============================================================ */
(function (GW) {
  "use strict";
  if (!GW) return;

  var esc = GW.esc, fmtMoney = GW.fmtMoney, fmtDate = GW.fmtDate;
  var today = GW.today, uid = GW.uid;
  var get = GW.get, put = GW.put, findClient = GW.findClient, clientLabel = GW.clientLabel;
  var docTotals = GW.docTotals;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var main = function () { return document.getElementById("admin-main"); };
  var K = { D: "ga_devis", F: "ga_factures", H: "ga_heures", P: "ga_paiements" };

  function cid() { return GW.currentClientId(); }
  function filterBy(list, key) {
    var id = cid();
    return id ? list.filter(function (x) { return x.clientId === id; }) : list;
  }
  function vatRates() { return [0, 5.5, 10, 20]; }

  /* Numérotation séquentielle par année (DE-2026-001 / FA-2026-001). */
  function nextNum(prefix) {
    var seq = GW.load("ga_seq", null) || {};
    var yr = String(new Date().getFullYear());
    var key = prefix + "-" + yr;
    seq[key] = (Number(seq[key]) || 0) + 1;
    GW.save("ga_seq", seq);
    return prefix + "-" + yr + "-" + String(seq[key]).padStart(3, "0");
  }

  function stripeFor(client) {
    var links = (window.GA_CONFIG && window.GA_CONFIG.stripe) || null;
    if (!links || !client) return "";
    var f = (client.formule || client.forfait || "").toString().toLowerCase().replace(/[^a-z0-9_]/g, "");
    var map = { essentiel: "essentiel", confort: "confort", pro: "pro", visibilite: "visibilite", visibilite_plus: "visibilite_plus", developpement: "developpement" };
    var k = map[f] || f;
    return links[k] || "";
  }

  /* ==================================================================
     MODULE : FACTURATION  (devis & factures, conversion, TVA, paiement)
     ================================================================== */
  var STF = { brouillon: ["Brouillon", "grey"], en_attente: ["Impayée", "warn"], payee: ["Payée", "ok"], annulee: ["Annulée", "grey"] };
  var STD = { brouillon: ["Brouillon", "grey"], en_attente: ["Envoyé", "warn"], accepte: ["Accepté", "ok"], refuse: ["Refusé", "danger"], facture: ["Facturé", "ok"], annulee: ["Annulé", "grey"] };
  var fView = { kind: "factures", mode: "list", id: null };
  var tbF = [];

  function docs(kind) { return GW.get(kind === "devis" ? K.D : K.F); }
  function putDocs(kind, list) { GW.put(kind === "devis" ? K.D : K.F, list); }
  function docOf(kind, id) { return docs(kind).filter(function (x) { return x.id === id; })[0] || null; }

  function finKpis() {
    var allF = filterBy(GW.get(K.F), cid());
    var allD = filterBy(GW.get(K.D), cid());
    var facture = allF.filter(function (x) { return x.statut !== "annulee"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var encaisse = allF.filter(function (x) { return x.statut === "payee"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var impaye = allF.filter(function (x) { return x.statut === "en_attente"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var retard = allF.filter(function (x) { return x.statut === "en_attente" && x.echeance && x.echeance < GW.today(); }).length;
    var devisTotal = allD.filter(function (x) { return x.statut !== "annulee" && x.statut !== "facture"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    return "<div class='ws-kpis'>" +
      GW.kpi("Facturé (TTC)", GW.fmtMoney(facture), "hors annulées") +
      GW.kpi("Encaissé", GW.fmtMoney(encaisse), "payées", "ok") +
      GW.kpi("Impayé", GW.fmtMoney(impaye), retard ? retard + " en retard" : "à encaisser", "warn") +
      GW.kpi("Devis en cours", GW.fmtMoney(devisTotal), "pipeline") +
      "</div>";
  }

  function listHTML() {
    var kind = fView.kind;
    var list = filterBy(docs(kind), cid()).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var statuts = kind === "devis" ? STD : STF;
    var rows = list.map(function (x) {
      var cl = findClient(x.clientId);
      var t = docTotals(x.lignes);
      var isF = kind === "factures";
      var late = isF && x.statut === "en_attente" && x.echeance && x.echeance < GW.today();
      return [
        "<b>" + esc(x.num || "—") + "</b>", cl ? esc(clientLabel(cl)) : "—", GW.fmtDate(x.date),
        isF ? (x.echeance ? GW.fmtDate(x.echeance) + (late ? " ⚠" : "") : "—") : (x.echeance ? "valide " + GW.fmtDate(x.echeance) : "—"),
        GW.fmtMoney(t.ttc), GW.badge((statuts[x.statut] || [x.statut || "—"])[0], (statuts[x.statut] || ["", "grey"])[1]),
        "<button class='mini-btn' data-open='" + x.id + "'>Ouvrir</button>" +
        (isF ? "" : "<button class='mini-btn ok' data-conv='" + x.id + "'>→ Facture</button>") +
        "<button class='mini-btn danger' data-del='" + x.id + "'>✕</button>"
      ];
    });
    var switchHtml = "<div class='ws-actions'><button class='mini-btn" + (kind === "devis" ? " primary" : "") + "' data-kind='devis'>Devis</button><button class='mini-btn" + (kind === "factures" ? " primary" : "") + "' data-kind='factures'>Factures</button></div>";
    tbF = [
      { action: "new-d", label: "＋ Devis", fn: function () { fView = { kind: "devis", mode: "edit", id: null }; GW.render(); } },
      { action: "new-f", label: "＋ Facture", fn: function () { fView = { kind: "factures", mode: "edit", id: null }; GW.render(); } }
    ];
    return finKpis() + GW.toolbar(tbF) +
      "<div class='ws-panel'><h3>" + (kind === "devis" ? "📝 Devis" : "🧾 Factures") + "</h3>" +
      GW.tableHTML(["Numéro", "Client", "Date", kind === "devis" ? "Validité" : "Échéance", "Total TTC", "Statut", "Actions"], rows, "Aucun document.") + "</div>";
  }

  function lineRowHTML(l) {
    l = l || { des: "", qte: 1, pu: "", tva: 20 };
    return "<tr class='fin-line'>" +
      "<td><input class='fin-des' value='" + GW.esc(l.des) + "' placeholder='Désignation'></td>" +
      "<td><input class='fin-qte' type='number' step='0.01' min='0' value='" + (l.qte == null ? 1 : l.qte) + "'></td>" +
      "<td><input class='fin-pu' type='number' step='0.01' min='0' value='" + GW.esc(l.pu) + "'></td>" +
      "<td><select class='fin-tva'>" + vatRates().map(function (r) { return "<option value='" + r + "'" + (Number(l.tva) === r ? " selected" : "") + ">" + String(r).replace(".", ",") + " %</option>"; }).join("") + "</select></td>" +
      "<td class='right fin-tot'>—</td>" +
      "<td><button type='button' class='mini-btn danger fin-rm'>✕</button></td></tr>";
  }

  function formHTML(kind, id) {
    var doc = id ? docOf(kind, id) : null;
    var isF = kind === "factures";
    var lignes = doc ? (doc.lignes || []) : [{ des: "", qte: 1, pu: "", tva: 20 }];
    return "<div class='ws-panel'><h3>" + (doc ? "Modifier " + esc(doc.num) : (isF ? "Nouvelle facture" : "Nouveau devis")) + "</h3><form id='fin-form' class='ws-form'>" +
      GW.formRow("Client", GW.select("clientId", [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; })), doc ? (doc.clientId || "") : (cid() || ""))) +
      GW.formRow("Date", GW.input("date", doc ? doc.date : GW.today(), "", "type='date'")) +
      GW.formRow(isF ? "Échéance" : "Valable jusqu'au", GW.input("echeance", doc ? doc.echeance : "", "", "type='date'")) +
      GW.formRow("Objet / note", GW.input("note", doc ? doc.note : "", "Prestation…")) +
      "<div class='ws-frow ws-frow-full'><label>Lignes (TVA par ligne)</label>" +
      "<div class='ws-table-wrap'><table class='ws-table fin-lines'><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total</th><th></th></tr></thead><tbody>" +
      lignes.map(lineRowHTML).join("") + "</tbody></table></div>" +
      "<div class='ws-actions' style='margin-top:8px;'><button type='button' class='mini-btn' id='fin-addline'>＋ Ajouter une ligne</button><span class='fin-total-wrap' style='margin-left:auto;font-weight:600;'>Total TTC : <span id='fin-grand'>—</span></span></div></div>" +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }

  function readLines() {
    var out = [];
    $$("#fin-form .fin-line").forEach(function (tr) {
      var des = $(".fin-des", tr).value.trim();
      var qte = Number($(".fin-qte", tr).value) || 0;
      var pu = Number($(".fin-pu", tr).value) || 0;
      var tva = Number($(".fin-tva", tr).value) || 0;
      if (des || pu) out.push({ des: des, qte: qte, pu: pu, tva: tva });
    });
    return out;
  }
  function recompute() {
    var grand = 0;
    $$("#fin-form .fin-line").forEach(function (tr) {
      var qte = Number($(".fin-qte", tr).value) || 0;
      var pu = Number($(".fin-pu", tr).value) || 0;
      var tva = Number($(".fin-tva", tr).value) || 0;
      var tot = qte * pu * (1 + tva / 100);
      grand += tot;
      $(".fin-tot", tr).textContent = GW.fmtMoney(tot);
    });
    var g = $("#fin-grand"); if (g) g.textContent = GW.fmtMoney(grand);
  }

  function viewHTML(kind, id) {
    var doc = docOf(kind, id);
    if (!doc) return GW.empty("Document introuvable.");
    var isF = kind === "factures";
    var cl = findClient(doc.clientId);
    var t = docTotals(doc.lignes);
    var rows = (doc.lignes || []).map(function (l) {
      return [GW.esc(l.des || "—"), (Number(l.qte) || 0), GW.fmtMoney(l.pu), (Number(l.tva) || 0) + " %", GW.fmtMoney((Number(l.qte) || 0) * (Number(l.pu) || 0))];
    });
    var pay = "";
    if (isF && doc.statut !== "payee") {
      var link = stripeFor(cl);
      pay = "<div class='ws-actions'>" +
        (link ? "<a class='mini-btn' href='" + link + "' target='_blank' rel='noopener'>💳 Lien de paiement Stripe</a>" : "") +
        "<button class='mini-btn ok' data-pay>Marquer payée</button></div>" +
        (link ? "" : "<p class='ws-hint'>Aucun lien Stripe pour ce client (renseignez sa formule dans sa fiche).</p>");
    }
    return "<div class='ws-panel'><h3>" + (isF ? "🧾 Facture " : "📄 Devis ") + GW.esc(doc.num) + "</h3>" +
      "<p class='ws-sub'>" + GW.esc(cl ? clientLabel(cl) : "—") + " · " + GW.fmtDate(doc.date) + (doc.echeance ? (isF ? " · échéance " : " · valable ") + GW.fmtDate(doc.echeance) : "") + " · " + GW.badge((isF ? STF : STD)[doc.statut] ? (isF ? STF : STD)[doc.statut][0] : doc.statut, (isF ? STF : STD)[doc.statut] ? (isF ? STF : STD)[doc.statut][1] : "grey") + "</p>" +
      (doc.note ? "<p class='ws-hint'>" + GW.esc(doc.note) + "</p>" : "") +
      GW.tableHTML(["Désignation", "Qté", "PU HT", "TVA", "Total HT"], rows) +
      "<p style='text-align:right;'><b>Total HT : " + GW.fmtMoney(t.ht) + " · TVA : " + GW.fmtMoney(t.tva) + " · <span style='font-size:1.15em;'>TTC " + GW.fmtMoney(t.ttc) + "</span></b></p>" +
      pay +
      "<div class='ws-actions'><button class='mini-btn' data-edit>Modifier</button>" +
      (isF ? "" : "<button class='mini-btn ok' data-conv>→ Convertir en facture</button>") +
      "<button class='mini-btn' data-xls>Exporter Excel</button>" +
      "<button class='mini-btn admin-btn-ghost' data-back>← Retour</button></div></div>";
  }

  function convertDoc(kind, id) {
    var d = docOf(kind, id);
    if (!d) return;
    if (kind !== "devis") return;
    var fac = {
      id: GW.uid(), clientId: d.clientId, num: nextNum("FA"), date: GW.today(),
      echeance: "", statut: "en_attente", note: d.note || "",
      lignes: (d.lignes || []).map(function (l) { return { des: l.des, qte: l.qte, pu: l.pu, tva: l.tva }; }),
      devisId: d.id, devisNum: d.num
    };
    putDocs("factures", GW.get(K.F).concat([fac]));
    putDocs("devis", GW.get(K.D).map(function (x) { return x.id === d.id ? Object.assign({}, x, { statut: "facture" }) : x; }));
    GW.toast("Devis converti en facture " + fac.num);
    fView = { kind: "factures", mode: "view", id: fac.id };
    GW.render();
  }

  function exportDoc(kind, doc) {
    var isF = kind === "factures";
    GW.exportExcel("gestaffaires-" + (doc.num || "doc") + ".xls", {
      head: ["Désignation", "Qté", "PU HT", "TVA", "Total HT"],
      body: (doc.lignes || []).map(function (l) { return [l.des, Number(l.qte) || 0, Number(l.pu) || 0, Number(l.tva) || 0, (Number(l.qte) || 0) * (Number(l.pu) || 0)]; })
    });
  }

  GW.register({
    id: "facturation", cat: "Suivi financier", name: "Facturation", icon: "🧾",
    tag: "Devis → facture · TVA · Stripe",
    render: function () {
      var kind = fView.kind;
      if (fView.mode === "form") return formHTML(kind, fView.id);
      if (fView.mode === "view") return viewHTML(kind, fView.id);
      return listHTML();
    },
    afterRender: function () {
      var kind = fView.kind;
      if (fView.mode === "form") {
        recompute();
        var form = $("#fin-form");
        if (!form) return;
        $$("#fin-form .fin-line input, #fin-form .fin-line select").forEach(function (el) { el.addEventListener("input", recompute); el.addEventListener("change", recompute); });
        $$("#fin-form .fin-rm").forEach(function (b) { b.addEventListener("click", function () { b.closest("tr").remove(); recompute(); }); });
        $("#fin-addline").addEventListener("click", function () {
          $("#fin-form .fin-lines tbody").insertAdjacentHTML("beforeend", lineRowHTML(null));
          recompute();
          var tr = $("#fin-form .fin-lines tbody").lastElementChild;
          $(".fin-rm", tr).addEventListener("click", function () { tr.remove(); recompute(); });
          $$("input, select", tr).forEach(function (el) { el.addEventListener("input", recompute); el.addEventListener("change", recompute); });
        });
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var f = e.target;
          var lignes = readLines();
          if (!lignes.length) { GW.toast("Ajoutez au moins une ligne"); return; }
          var isF = kind === "factures";
          var data = {
            clientId: f.clientId.value || null, date: f.date.value || GW.today(),
            echeance: f.echeance.value || "", note: f.note.value.trim(), lignes: lignes
          };
          var list = docs(kind);
          if (fView.id) list = list.map(function (x) { return x.id === fView.id ? Object.assign({}, x, data) : x; });
          else { data.id = GW.uid(); data.num = nextNum(isF ? "FA" : "DE"); data.statut = "brouillon"; if (isF) data.statut = "en_attente"; list = list.concat([data]); }
          putDocs(kind, list);
          GW.toast("Document enregistré");
          fView = { kind: kind, mode: "list", id: null };
          GW.render();
        });
        $("[data-back]", main()).addEventListener("click", function () { fView = { kind: kind, mode: "list", id: null }; GW.render(); });
      } else if (fView.mode === "view") {
        var doc = docOf(kind, fView.id);
        var back = $("[data-back]", main()); if (back) back.addEventListener("click", function () { fView = { kind: kind, mode: "list", id: null }; GW.render(); });
        var edit = $("[data-edit]", main()); if (edit) edit.addEventListener("click", function () { fView = { kind: kind, mode: "form", id: fView.id }; GW.render(); });
        var conv = $("[data-conv]", main()); if (conv) conv.addEventListener("click", function () { convertDoc(kind, fView.id); });
        var pay = $("[data-pay]", main()); if (pay) pay.addEventListener("click", function () {
          putDocs(kind, docs(kind).map(function (x) { return x.id === fView.id ? Object.assign({}, x, { statut: "payee", paye: GW.today() }) : x; }));
          GW.toast("Facture marquée payée"); GW.render();
        });
        var xls = $("[data-xls]", main()); if (xls) xls.addEventListener("click", function () { if (doc) exportDoc(kind, doc); });
      } else {
        GW.bindToolbar(tbF);
        $$("[data-open]", main()).forEach(function (b) { b.addEventListener("click", function () { fView = { kind: kind, mode: "view", id: b.getAttribute("data-open") }; GW.render(); }); });
        $$("[data-conv]", main()).forEach(function (b) { b.addEventListener("click", function () { convertDoc(kind, b.getAttribute("data-conv")); }); });
        $$("[data-del]", main()).forEach(function (b) { b.addEventListener("click", function () {
          if (!confirm("Supprimer ce document ?")) return;
          putDocs(kind, docs(kind).filter(function (x) { return x.id !== b.getAttribute("data-del"); }));
          GW.toast("Document supprimé"); GW.render();
        }); });
      }
    }
  });

  /* ==================================================================
     MODULE : TEMPS & FORFAITS
     ================================================================== */
  var tView = { mode: "list" };
  var tbT = [];
  function heures() { return GW.get(K.H); }
  function saveHeures(l) { GW.put(K.H, l); }
  function heuresOf(x) { return Number(x.heures) || Number(x.h) || 0; }
  function tarifOf(x) { return Number(x.tarif) || Number(x.taux) || 45; }
  function montantH(x) { return x.montant != null ? Number(x.montant) : heuresOf(x) * tarifOf(x); }
  function moisOf(x) { return x.date ? String(x.date).slice(0, 7) : (x.mois || ""); }
  function monthNow() { return GW.today().slice(0, 7); }

  function tempsHTML() {
    var thisMonth = monthNow();
    var h = filterBy(heures(), cid());
    var moisRows = h.filter(function (x) { return moisOf(x) === thisMonth; });
    var totH = h.reduce(function (s, x) { return s + heuresOf(x); }, 0);
    var val = h.reduce(function (s, x) { return s + montantH(x); }, 0);
    var aFacturer = h.filter(function (x) { return x.statut !== "facture"; });
    var hFac = h.filter(function (x) { return x.statut === "facture"; }).reduce(function (s, x) { return s + montantH(x); }, 0);
    var rows = h.slice().sort(function (a, b) { return String(b.date || b.mois || "").localeCompare(a.date || a.mois || ""); }).map(function (x) {
      var cl = findClient(x.clientId);
      return [GW.fmtDate(x.date) || (x.mois || "—"), cl ? GW.esc(clientLabel(cl)) : "—", GW.esc(x.tache || x.label || "—"),
        heuresOf(x).toFixed(1).replace(".", ",") + " h", GW.fmtMoney(tarifOf(x)), GW.fmtMoney(montantH(x)),
        GW.badge(x.statut === "facture" ? "Facturé" : "À facturer", x.statut === "facture" ? "ok" : "warn")];
    });
    tbT = [
      { action: "add", label: "＋ Saisir des heures", fn: function () { tView = { mode: "form" }; GW.render(); } },
      { action: "xls", label: "Exporter (Excel)", fn: function () {
        GW.exportExcel("gestaffaires-temps.xls", { head: ["Date/Mois", "Client", "Tâche", "Heures", "Tarif", "Montant", "Statut"], body: h.map(function (x) { var c = findClient(x.clientId); return [moisOf(x), c ? clientLabel(c) : "", x.tache || x.mois || "", heuresOf(x), tarifOf(x), montantH(x), x.statut || ""]; }) });
      } }
    ];
    return "<div class='ws-kpis'>" +
      GW.kpi("Heures ce mois", (heures().filter(function (x) { return moisOf(x) === thisMonth && (!cid() || x.clientId === cid()); }).reduce(function (s, x) { return s + heuresOf(x); }, 0)).toFixed(1).replace(".", ",") + " h", thisMonth) +
      GW.kpi("Valeur à facturer", GW.fmtMoney(h.filter(function (x) { return x.statut !== "facture"; }).reduce(function (s, x) { return s + montantH(x); }, 0)), "non facturé", "warn") +
      GW.kpi("Total heures", (h.reduce(function (s, x) { return s + heuresOf(x); }, 0)).toFixed(1).replace(".", ",") + " h", "historique") +
      "</div>" +
      GW.toolbar(tbT) +
      "<div class='ws-panel'><h3>⏱️ Temps passé</h3>" +
      GW.tableHTML(["Date/Mois", "Client", "Tâche", "Heures", "Tarif", "Montant", "Statut"], rows, "Aucune heure saisie.") + "</div>";
  }

  function tempsForm() {
    return "<div class='ws-panel'><h3>⏱️ Saisir des heures</h3><form id='tm-form' class='ws-form'>" +
      GW.formRow("Date", GW.input("date", GW.today(), "", "type='date'")) +
      GW.formRow("Client", GW.select("clientId", [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; })), cid() || "")) +
      GW.formRow("Tâche", GW.input("tache", "", "Ex : rédaction, réunion…")) +
      GW.formRow("Heures", GW.money("heures", "")) +
      GW.formRow("Tarif horaire (€)", GW.money("tarif", 45)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }

  GW.register({
    id: "temps", cat: "Suivi financier", name: "Temps", icon: "⏱️",
    tag: "Heures · forfaits · valeur",
    render: function () { return tView.mode === "form" ? tempsForm() : tempsHTML(); },
    afterRender: function () {
      if (tView.mode === "form") {
        var f = $("#tm-form"); if (!f) return;
        f.addEventListener("submit", function (e) {
          e.preventDefault();
          var heures = Number(f.heures.value) || 0;
          if (!heures) { GW.toast("Saisissez un nombre d'heures"); return; }
          var tarif = Number(f.tarif.value) || 0;
          var list = heures();
          list.push({ id: GW.uid(), clientId: f.clientId.value || null, date: f.date.value || GW.today(), mois: (f.date.value || GW.today()).slice(0, 7), tache: f.tache.value.trim(), heures: heures, tarif: tarif, montant: heures * tarif, statut: "attente" });
          saveHeures(list);
          GW.toast("Heures enregistrées");
          tView = { mode: "list" }; GW.render();
        });
        $("[data-back]", main()).addEventListener("click", function () { tView = { mode: "list" }; GW.render(); });
      } else {
        GW.bindToolbar(tbT);
      }
    }
  });

}(window.GestWorkspace));
