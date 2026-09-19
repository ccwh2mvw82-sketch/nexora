/* ============================================================
   GestAffaires – Espace de travail · Modules GESTION & PILOTAGE
   workspace-g.js
   Modules : Gestion (facturation/relances), Comptabilité,
   Dossiers client, Reporting / accompagnement.
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
  var adminMain = function () { return document.getElementById("admin-main"); };
  var K = {
    F: "ga_factures", D: "ga_devis", C: "ga_contrats",
    R: "ga_relances", DP: "ga_depenses", EC: "ga_echeances",
    DOC: "ga_documents", H: "ga_heures"
  };

  function cid() { return GW.currentClientId(); }
  function cname() {
    var c = GW.selectedClient();
    return c ? clientLabel(c) : "(tous les clients)";
  }
  function filterBy(list, key) {
    var id = cid();
    return id ? list.filter(function (x) { return x.clientId === id; }) : list;
  }
  function noClientNote() {
    return "<p class='ws-hint' style='max-width:760px;'>Sélectionnez un client ci-dessus pour ne voir que ses données. Sans client, affichage global.</p>";
  }
  function fnSlug() {
    var c = GW.selectedClient();
    if (!c) return "";
    return "-" + String(clientLabel(c)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  }

  /* ==================================================================
     MODULE : GESTION  (cœur : devis, factures, relances, suivi)
     ================================================================== */
  var statutF = { brouillon: ["Brouillon", "grey"], en_attente: ["Émise / impayée", "warn"], payee: ["Payée", "ok"], annulee: ["Annulée", "grey"] };
  var statutD = { brouillon: ["Brouillon", "grey"], en_attente: ["Envoyé", "warn"], accepte: ["Accepté", "ok"], refuse: ["Refusé", "danger"], annulee: ["Annulé", "grey"] };
  var tbGestion = [];

  function relanceStade(n) {
    return n === 1 ? "Relance amiable (J+7)" : n === 2 ? "2e relance (J+15)" : n === 3 ? "Mise en demeure (J+30)" : "Relance";
  }

  GW.register({
    id: "gestion",
    cat: "Gestion & Pilotage",
    name: "Gestion",
    tag: "Devis · Factures · Relances · Suivi",
    icon: "🧾",
    render: function () {
      var F = get(K.F), D = get(K.D);
      var f = filterBy(F, cid()), d = filterBy(D, cid());
      var total = f.reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
      var aEncaisser = f.filter(function (x) { return x.statut !== "payee" && x.statut !== "annulee"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
      var impayees = f.filter(function (x) { return x.statut === "en_attente"; }).length;
      var relances = filterBy(get(K.R), cid());

      tbGestion = [
        { action: "xls-f", label: "Exporter les factures (Excel)", fn: function () { exportDocs("F"); } },
        { action: "csv-f", label: "Export CSV", fn: function () { exportDocs("F", true); } },
        { action: "pdf-f", label: "Imprimer le suivi", fn: function () { printSuivi(); } }
      ];

      var famount = f.map(function (x) {
        var cl = findClient(x.clientId);
        var sbadge = statutF[x.statut] || statutF.brouillon;
        return { obj: x, cl: cl, tot: docTotals(x.lignes), badge: sbadge };
      });
      var sumFTtc = famount.reduce(function (s, r) { return s + r.tot.ttc; }, 0);
      var sumFEncaisse = famount.filter(function (r) { return r.obj.statut === "payee"; }).reduce(function (s, r) { return s + r.tot.ttc; }, 0);
      var frows = famount.map(function (r) {
        return [
          "<b>" + esc(r.obj.num) + "</b>",
          esc(r.cl ? clientLabel(r.cl) : "—"),
          fmtDate(r.obj.date) + (r.obj.echeance ? "<br><small>échéance " + fmtDate(r.obj.echeance) + "</small>" : ""),
          GW.monRight(r.tot.ttc),
          GW.badge(r.badge[0], r.badge[1]),
          docActions("F", r.obj)
        ];
      });
      var damount = d.map(function (x) {
        var cl = findClient(x.clientId);
        var sbadge = statutD[x.statut] || statutD.brouillon;
        return { obj: x, cl: cl, tot: docTotals(x.lignes), badge: sbadge };
      });
      var sumDTtc = damount.filter(function (r) { return r.obj.statut !== "annulee"; }).reduce(function (s, r) { return s + r.tot.ttc; }, 0);
      var drows = damount.map(function (r) {
        return [
          "<b>" + esc(r.obj.num) + "</b>",
          esc(r.cl ? clientLabel(r.cl) : "—"),
          fmtDate(r.obj.date),
          GW.monRight(r.tot.ttc),
          GW.badge(r.badge[0], r.badge[1]),
          docActions("D", r.obj)
        ];
      });
      var rrows = relances.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).map(function (r) {
        var cl = findClient(r.clientId);
        return [fmtDate(r.date), esc(cl ? clientLabel(cl) : "—"), esc(r.docNum || ""), esc(relanceStade(r.stade)), GW.badge(r.etat || "envoi", r.etat === "fait" ? "ok" : "warn"), "<button class='mini-btn' data-relview='" + r.id + "'>Voir</button>"];
      });

      var fFoot = ["<b>Total</b>", "", "", GW.monRight(sumFTtc), "", ""];
      var dFoot = ["<b>Total</b>", "", "", GW.monRight(sumDTtc), "", ""];

      return noClientNote() +
        "<div class='ws-kpis'>" +
        GW.kpi("Total facturé", fmtMoney(total), cname()) +
        GW.kpi("Encaissé", fmtMoney(sumFEncaisse), "factures payées", "ok") +
        GW.kpi("À encaisser", fmtMoney(aEncaisser), "échéances restantes") +
        GW.kpi("Factures impayées", impayees, "à relancer", "warn") +
        "</div>" +
        GW.toolbar(tbGestion) +
        "<div class='ws-panel'><h3>📄 Factures</h3>" + GW.tableHTML(["N°", "Client", "Date / échéance", "Total TTC", "Statut", "Actions"], frows, "Aucune facture.", fFoot) + "</div>" +
        "<div class='ws-panel'><h3>📝 Devis</h3>" + GW.tableHTML(["N°", "Client", "Date", "Total TTC", "Statut", "Actions"], drows, "Aucun devis.", dFoot) + "</div>" +
        "<div class='ws-panel'><h3>📨 Relances émises</h3>" + GW.tableHTML(["Date", "Client", "Document", "Stade", "État", ""], rrows, "Aucune relance pour le moment. Utilisez le bouton « Relancer » sur une facture en attente.") + "</div>";

      function docActions(type, obj) {
        var isF = type === "F";
        var btns = '<div class="row-actions">';
        btns += "<button class='mini-btn primary' data-action='print-gdoc' data-type='" + type + "' data-id='" + obj.id + "'>Imprimer</button>";
        if (isF) {
          if (obj.statut !== "payee") btns += "<button class='mini-btn ok' data-action='mark-paid' data-id='" + obj.id + "'>Marquer payée</button>";
          if (obj.statut === "en_attente") btns += "<button class='mini-btn warn' data-action='relance' data-id='" + obj.id + "'>Relancer</button>";
        } else {
          if (obj.statut === "en_attente") btns += "<button class='mini-btn ok' data-action='accept-devis' data-id='" + obj.id + "'>Accepter</button>";
        }
        btns += "</div>";
        return btns;
      }

      function exportDocs(type, csv) {
        var isF = type === "F";
        var list = isF ? f : d;
        var rows = {
          head: isF ? ["Numéro", "Client", "Date", "Échéance", "Total HT", "TVA", "Total TTC", "Statut"] : ["Numéro", "Client", "Date", "Total HT", "TVA", "Total TTC", "Statut"],
          body: list.map(function (x) {
            var cl = findClient(x.clientId);
            var t = docTotals(x.lignes);
            var base = [x.num, cl ? (cl.name + (cl.company ? " (" + cl.company + ")" : "")) : "", x.date, x.echeance || ""];
            var st = isF ? (statutF[x.statut] || statutF.brouillon)[0] : (statutD[x.statut] || statutD.brouillon)[0];
            var end = [t.ht, t.tva, t.ttc, st];
            return base.concat(end);
          })
        };
        var name = (isF ? "factures" : "devis") + fnSlug() + "-" + today() + (csv ? ".csv" : ".xls");
        if (csv) GW.exportCSV(name, rows); else GW.exportExcel(name, rows);
      }

      function printSuivi() {
        function rowsHTML(list, isF) {
          return list.map(function (r) {
            var stLabel = (isF ? statutF : statutD)[r.obj.statut];
            return "<tr><td>" + esc(r.obj.num) + "</td><td>" + esc(r.cl ? clientLabel(r.cl) : "") + "</td><td>" + fmtDate(r.obj.date) + (r.obj.echeance ? " → " + fmtDate(r.obj.echeance) : "") + "</td><td class='right'>" + fmtMoney(r.tot.ttc) + "</td><td>" + (stLabel ? stLabel[0] : "") + "</td></tr>";
          }).join("");
        }
        var body =
          "<h3 style='text-transform:uppercase;font-size:12px;letter-spacing:.12em;color:#1b3358;'>Suivi de facturation · " + esc(cname()) + "</h3>" +
          "<p style='font-size:12px;color:#5b6b7b;'>Édité le " + fmtDate(today()) + "</p>" +
          "<table class='ps-table'><thead><tr><th>N°</th><th>Client</th><th>Date / échéance</th><th>Total TTC</th><th>Statut</th></tr></thead><tbody>" +
          rowsHTML(famount, true) + "</tbody></table>" +
          "<h3 style='text-transform:uppercase;font-size:12px;letter-spacing:.12em;color:#1b3358;margin-top:18px;'>Devis en cours</h3>" +
          "<table class='ps-table'><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total TTC</th><th>Statut</th></tr></thead><tbody>" +
          rowsHTML(damount, false) + "</tbody></table>";
        GW.printHTML("Suivi de gestion", body);
      }
    },
    afterRender: function () {
      GW.bindToolbar(tbGestion);
      $$("[data-action='print-gdoc']", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () { printGDoc(b.getAttribute("data-type"), b.getAttribute("data-id")); });
      });
      $$("[data-action='mark-paid']", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id");
          var list = get(K.F).map(function (x) { return x.id === id ? Object.assign({}, x, { statut: "payee" }) : x; });
          put(K.F, list);
          GW.toast("Facture marquée payée");
          GW.render();
        });
      });
      $$("[data-action='accept-devis']", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id");
          var list = get(K.D).map(function (x) { return x.id === id ? Object.assign({}, x, { statut: "accepte" }) : x; });
          put(K.D, list);
          GW.toast("Devis accepté");
          GW.render();
        });
      });
      $$("[data-action='relance']", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () { startRelance(b.getAttribute("data-id")); });
      });
      $$("[data-relview]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () { viewRelance(b.getAttribute("data-relview")); });
      });
    }
  });

  /* --- impression réutilisant la feuille du site (facture/devis) --- */
  function printGDoc(type, id) {
    var key = type === "F" ? K.F : K.D;
    var list = get(key);
    var doc = list.filter(function (x) { return x.id === id; })[0];
    if (!doc) return;
    var cl = findClient(doc.clientId);
    var tot = docTotals(doc.lignes);
    var isF = type === "F";
    var st = isF ? doc.statut : doc.statut;
    var stLabel = (isF ? statutF : statutD)[st];
    var logo = "🅶";
    var rows = doc.lignes.map(function (l) {
      return "<tr><td>" + esc(l.des || "—") + "</td><td class='right'>" + (Number(l.qte) || 0) + "</td><td class='right'>" + fmtMoney(l.pu) + "</td><td class='right'>" + (Number(l.tva) || 0) + " %</td><td class='right'>" + fmtMoney((Number(l.qte) || 0) * (Number(l.pu) || 0)) + "</td></tr>";
    }).join("");
    var body =
      "<table style='width:100%;border-collapse:collapse;'><tr>" +
      "<td style='vertical-align:top;'><div style='width:76px;height:76px;border-radius:16px;background:#0B1B33;color:#0CB5A6;font-weight:800;font-size:34px;text-align:center;line-height:76px;'>" + logo + "</div><div style='font-size:12px;margin-top:6px;'><b>GestAffaires</b><br>Gestion · Administration · Digital</div></td>" +
      "<td style='text-align:right;'><h1 style='margin:0;color:#0B1B33;'>" + (isF ? "FACTURE" : "DEVIS") + "</h1><p style='margin:2px 0;color:#5b6b7b;'>" + esc(doc.num) + "<br>Date : " + fmtDate(doc.date) + (doc.echeance ? (isF ? "<br>Échéance : " : "<br>Valable jusqu'au : ") + fmtDate(doc.echeance) : "") + "</p></td></tr></table>" +
      "<hr style='border:none;border-top:2px solid #0CB5A6;'>" +
      "<table style='width:100%;'><tr><td style='vertical-align:top;'><b>Émetteur</b><br>GestAffaires<br>06 12 34 56 78<br>contact@gestaffaires.fr</td>" +
      "<td style='vertical-align:top;text-align:right;'><b>" + esc(isF ? "Client" : "Client") + "</b><br>" + esc(cl ? (cl.name + (cl.company ? "<br>" + cl.company : "") + (cl.address ? "<br>" + cl.address : "") + (cl.email ? "<br>" + cl.email : "") + (cl.phone ? "<br>" + cl.phone : "")) : "—") + "</td></tr></table>" +
      (doc.notes ? "<p style='font-size:12px;'>Note : " + esc(doc.notes) + "</p>" : "") +
      "<table class='ps-table'><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table style='width:260px;margin-left:auto;' class='ps-table'><tr><td>Total HT</td><td class='right'>" + fmtMoney(tot.ht) + "</td></tr><tr><td>TVA</td><td class='right'>" + fmtMoney(tot.tva) + "</td></tr><tr><td><b>Total TTC</b></td><td class='right'><b>" + fmtMoney(tot.ttc) + "</b></td></tr><tr><td colspan='2'><span class='ws-pill " + (stLabel ? stLabel[1] : "") + "'>" + (stLabel ? esc(stLabel[0]) : "") + "</span></td></tr></table>" +
      "<table style='width:100%;margin-top:22px;'><tr><td style='width:50%;'>Le prestataire</td><td style='width:50%;text-align:right;'>Le client</td></tr><tr><td style='height:48px;'></td><td></td></tr></table>" +
      "<p style='font-size:11px;color:#8a98a8;'>GestAffaires – Gestion &amp; Digital · 06 12 34 56 78 · contact@gestaffaires.fr</p>";
    GW.printHTML(isF ? "Facture" : "Devis", body);
  }

  /* --- relance : choix du stade puis génération --- */
  function startRelance(docId) {
    var doc = get(K.F).filter(function (x) { return x.id === docId; })[0];
    if (!doc) return;
    var cl = findClient(doc.clientId);
    var existing = get(K.R).filter(function (r) { return r.docId === docId; });
    var niveau = existing.length + 1;
    var tot = docTotals(doc.lignes);
    showRelanceInPage(doc, cl, tot, niveau, existing.length);
  }

  function lettreRelance(niveau, doc, cl, tot) {
    var dest = cl ? (cl.name || cl.company || "le client") : "le client";
    var nums = doc.num;
    var due = doc.echeance ? "le " + fmtDate(doc.echeance) : "à réception";
    if (niveau === 1) {
      return "Objet : facture " + nums + " arrivée à échéance\n\nBonjour,\nNous vous rappelons que la facture " + nums + " d'un montant de " + fmtMoney(tot.ttc) + " est arrivée à échéance " + due + ".\nNous restons à votre disposition pour toute précision. Merci de votre règlement.\n\nCordialement,\nGestAffaires";
    }
    if (niveau === 2) {
      return "Objet : relance facture " + nums + "\n\nBonjour,\nNotre précédente demande concernant la facture " + nums + " (" + fmtMoney(tot.ttc) + ", échéance " + due + ") est restée sans suite.\nNous vous remercions de bien vouloir procéder au règlement sous huit jours.\n\nCordialement,\nGestAffaires";
    }
    return "Objet : mise en demeure de payer – facture " + nums + "\n\nÀ l'attention de " + dest + ",\nEn dépit de nos deux précédentes relances, la facture " + nums + " d'un montant de " + fmtMoney(tot.ttc) + " demeure impayée.\nSans règlement sous quinze jours, nous serons contraints d'engager les démarches de recouvrement prévues.\n\nCordialement,\nGestAffaires";
  }

  function showRelanceInPage(doc, cl, tot, niveau, count) {
    var main = $("#admin-main");
    if (!main) { GW.render(); main = $("#admin-main"); }
    var letter = lettreRelance(niveau, doc, cl, tot);
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📨 Relance · " + esc(doc.num) + " · " + esc(cl ? clientLabel(cl) : "") + "</h3>" +
      "<p class='ws-hint'>Stade : <b>" + relanceStade(niveau) + "</b> (" + count + " relance(s) déjà émise(s)).</p>" +
      "<div class='ws-box'><p class='ws-label'>Lettre prête à envoyer</p><pre class='ws-pre'>" + esc(letter) + "</pre></div>" +
      "<div class='ws-actions'>" +
      "<button class='mini-btn primary' data-rel-ok>Enregistrer la relance</button>" +
      "<button class='mini-btn' data-rel-copy>Copier le texte</button>" +
      "<button class='mini-btn' data-rel-cancel>Annuler</button></div></div>";
    $("[data-rel-ok]").addEventListener("click", function () {
      var list = get(K.R);
      list.push({ id: uid(), clientId: doc.clientId, docId: doc.id, docNum: doc.num, stade: niveau, date: today(), etat: "fait", texte: letter });
      put(K.R, list);
      GW.toast("Relance enregistrée dans l'historique");
      GW.render();
    });
    $("[data-rel-copy]").addEventListener("click", function () { GW.copyText(letter); });
    $("[data-rel-cancel]").addEventListener("click", function () { GW.render(); });
  }

  function viewRelance(id) {
    var r = get(K.R).filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var cl = findClient(r.clientId);
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📨 Relance · " + esc(r.docNum) + "</h3>" +
      "<p class='ws-hint'>" + fmtDate(r.date) + " · " + esc(cl ? clientLabel(cl) : "") + " · " + esc(relanceStade(r.stade)) + "</p>" +
      "<div class='ws-box'><pre class='ws-pre'>" + esc(r.texte) + "</pre></div>" +
      "<div class='ws-actions'><button class='mini-btn' data-rel-copy>Copier</button><button class='mini-btn' data-rel-back>Retour</button></div></div>";
    $("[data-rel-copy]").addEventListener("click", function () { GW.copyText(r.texte); });
    $("[data-rel-back]").addEventListener("click", function () { GW.render(); });
  }

  /* ==================================================================
     MODULE : COMPTABILITÉ / PRÉPARATION POUR L'EXPERT-COMPTABLE
     ================================================================== */
  var CATS = ["Fournisseur", "Loyer / Charges", "Matériel", "Déplacements", "Frais bancaires", "Sous-traitance", "Autre"];
  var tbCompta = [];
  GW.register({
    id: "compta",
    cat: "Gestion & Pilotage",
    name: "Comptabilité",
    tag: "Dépenses · TVA · Export comptable",
    icon: "🧮",
    render: function () {
      var dp = filterBy(get(K.DP), cid());
      var ec = filterBy(get(K.EC), cid());
      var totHT = dp.reduce(function (s, x) { return s + (Number(x.montantHT) || 0); }, 0);
      var totTVA = dp.reduce(function (s, x) { return s + (Number(x.tva) || 0); }, 0);
      var byCat = {};
      dp.forEach(function (x) { byCat[x.cat || "Autre"] = (byCat[x.cat || "Autre"] || 0) + (Number(x.montantHT) || 0); });
      var catRows = Object.keys(byCat).map(function (k) { return [esc(k), GW.monRight(byCat[k]), Math.round(byCat[k] / (totHT || 1) * 100) + " %"]; });
      tbCompta = [
        { action: "add-dep", label: "＋ Saisir une dépense", fn: function () { depForm(); } },
        { action: "add-ech", label: "＋ Ajouter une échéance", fn: function () { echForm(); } },
        { action: "xls-compta", label: "Export comptable (Excel)", fn: function () { exportCompta(); } },
        { action: "pdf-compta", label: "Récap imprimable", fn: function () { printCompta(); } }
      ];

      var dpRows = dp.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).map(function (x) {
        var cl = findClient(x.clientId);
        return [fmtDate(x.date), esc(cl ? clientLabel(cl) : "—"), esc(x.fourn || ""), esc(x.cat || ""), esc(x.lib || ""), GW.monRight(x.montantHT), GW.monRight(x.tva), "<button class='mini-btn danger' data-deld='" + x.id + "'>✕</button>"];
      });
      var ecRows = ec.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); }).map(function (x) {
        var cl = findClient(x.clientId);
        var ok = x.statut === "fait";
        return [fmtDate(x.date), esc(x.type || ""), esc(cl ? clientLabel(cl) : "—"), GW.monRight(x.montant || 0), GW.badge(ok ? "Fait" : "À faire", ok ? "ok" : "warn"), "<button class='mini-btn' data-echok='" + x.id + "'>" + (ok ? "Annuler" : "Marquer fait") + "</button>"];
      });
      var dpFoot = ["<b>Total</b>", "", "", "", "", GW.monRight(totHT), GW.monRight(totTVA), ""];

      return noClientNote() +
        "<div class='ws-kpis'>" +
        GW.kpi("Dépenses HT", fmtMoney(totHT), "période totale") +
        GW.kpi("TVA déductible", fmtMoney(totTVA), "à récupérer") +
        "</div>" +
        GW.toolbar(tbCompta) +
        "<div class='ws-panel'><h3>💶 Dépenses</h3>" + GW.tableHTML(["Date", "Client", "Fournisseur", "Catégorie", "Libellé", "Montant HT", "TVA", ""], dpRows, "Aucune dépense saisie.", dpFoot) + "</div>" +
        "<div class='ws-panel'><h3>🗂 Répartition par catégorie</h3>" + GW.tableHTML(["Catégorie", "Montant HT", "Part"], catRows, "Saisissez des dépenses pour voir la répartition.") + "</div>" +
        "<div class='ws-panel'><h3>📅 Échéances (TVA · URSSAF · CFE …)</h3>" + GW.tableHTML(["Date", "Type", "Client", "Montant", "État", ""], ecRows, "Aucune échéance.") + "</div>";
    },
    afterRender: function () {
      GW.bindToolbar(tbCompta);
      $$("[data-deld]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          put(K.DP, get(K.DP).filter(function (x) { return x.id !== b.getAttribute("data-deld"); }));
          GW.toast("Dépense supprimée");
          GW.render();
        });
      });
      $$("[data-echok]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-echok");
          put(K.EC, get(K.EC).map(function (x) { return x.id === id ? Object.assign({}, x, { statut: x.statut === "fait" ? "attente" : "fait" }) : x; }));
          GW.render();
        });
      });
    }
  });

  function exportCompta() {
    var dp = filterBy(get(K.DP), cid());
    var rows = {
      head: ["Date", "Client", "Fournisseur", "Catégorie", "Libellé", "Montant HT", "TVA", "Montant TTC"],
      body: dp.map(function (x) {
        var cl = findClient(x.clientId);
        return [x.date, cl ? (cl.name + " (" + cl.company + ")") : "", x.fourn, x.cat, x.lib, Number(x.montantHT) || 0, Number(x.tva) || 0, (Number(x.montantHT) || 0) + (Number(x.tva) || 0)];
      })
    };
    GW.exportExcel("export-comptable-" + today() + ".xls", rows);
  }
  function printCompta() {
    var dp = filterBy(get(K.DP), cid());
    var rows = dp.map(function (x) {
      var cl = findClient(x.clientId);
      return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(cl ? clientLabel(cl) : "") + "</td><td>" + esc(x.fourn || "") + "</td><td>" + esc(x.cat || "") + "</td><td>" + esc(x.lib || "") + "</td><td class='right'>" + fmtMoney(x.montantHT) + "</td><td class='right'>" + fmtMoney(x.tva) + "</td></tr>";
    }).join("");
    GW.printHTML("Préparation comptable",
      "<h3 style='text-transform:uppercase;font-size:12px;letter-spacing:.12em;color:#1b3358;'>Dépenses · " + esc(cname()) + "</h3>" +
      "<table class='ps-table'><thead><tr><th>Date</th><th>Client</th><th>Fournisseur</th><th>Catégorie</th><th>Libellé</th><th>HT</th><th>TVA</th></tr></thead><tbody>" + rows + "</tbody></table>");
  }

  function depForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>💶 Nouvelle dépense</h3><form id='ws-dep-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Date", GW.input("date", today(), "", "type='date'")) +
      GW.formRow("Fournisseur", GW.input("fourn", "", "Ex : EDF, Leclerc…")) +
      GW.formRow("Catégorie", GW.select("cat", CATS, CATS[0])) +
      GW.formRow("Libellé", GW.input("lib", "", "Ex : électricité du mois")) +
      GW.formRow("Montant HT", GW.money("montantHT")) +
      GW.formRow("TVA (€)", GW.money("tva")) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-dep-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var obj = {
        id: uid(), clientId: f.clientId.value || null, date: f.date.value || today(),
        fourn: f.fourn.value.trim(), cat: f.cat.value, lib: f.lib.value.trim(),
        montantHT: Number(f.montantHT.value) || 0, tva: Number(f.tva.value) || 0
      };
      if (!obj.fourn && !obj.lib) { GW.toast("Renseignez au moins le fournisseur ou le libellé"); return; }
      var list = get(K.DP);
      list.push(obj);
      put(K.DP, list);
      GW.toast("Dépense enregistrée");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  function echForm() {
    var types = ["TVA (déclaration)", "URSSAF (cotisations)", "CFE (foncière)", "Impôt sur les sociétés", "Loyer", "Assurance", "Autre"];
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📅 Nouvelle échéance</h3><form id='ws-ech-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Date", GW.input("date", today(), "", "type='date'")) +
      GW.formRow("Type", GW.select("type", types)) +
      GW.formRow("Montant", GW.money("montant")) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-ech-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var list = get(K.EC);
      list.push({ id: uid(), clientId: f.clientId.value || null, date: f.date.value || today(), type: f.type.value, montant: Number(f.montant.value) || 0, statut: "attente" });
      put(K.EC, list);
      GW.toast("Échéance ajoutée");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  /* ==================================================================
     MODULE : DOSSIERS CLIENT (classement par client)
     ================================================================== */
  var tbDossiers = [];
  GW.register({
    id: "dossiers",
    cat: "Gestion & Pilotage",
    name: "Dossiers client",
    tag: "Pièces · Documents · Notes · Historique",
    icon: "🗂️",
    render: function () {
      var items = filterBy(get(K.DOC), cid()).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var rows = items.map(function (x) {
        var cl = findClient(x.clientId);
        var img = x.dataUrl ? "<img src='" + x.dataUrl + "' class='ws-doc-img'>" : "";
        return ["<div class='ws-doc-cell'>" + img + "</div>", fmtDate(x.date), esc(cl ? clientLabel(cl) : "—"), esc(x.titre || ""), esc(x.type || ""), "<button class='mini-btn danger' data-deldoc='" + x.id + "'>✕</button>"];
      });
      tbDossiers = [
        { action: "add-doc", label: "＋ Joindre un document / une pièce", fn: function () { docForm(); } },
        { action: "xls-doc", label: "Exporter la liste (Excel)", fn: function () {
          GW.exportExcel("dossiers-" + today() + ".xls", {
            head: ["Date", "Client", "Titre", "Type"],
            body: filterBy(get(K.DOC), cid()).map(function (x) { return [x.date, x.clientId ? clientLabel(findClient(x.clientId)) : "", x.titre, x.type]; })
          });
        } }
      ];
      return noClientNote() +
        GW.toolbar(tbDossiers) +
        "<div class='ws-panel'><h3>🗂 Documents du dossier</h3>" + GW.tableHTML(["Pièce", "Date", "Client", "Titre", "Type", ""], rows, "Aucune pièce jointe. Ajoutez des documents (photo de contrat, justificatif, facture fournisseur…) pour les ranger dans le dossier du client.") + "</div>";
    },
    afterRender: function () {
      GW.bindToolbar(tbDossiers);
      $$("[data-deldoc]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          put(K.DOC, get(K.DOC).filter(function (x) { return x.id !== b.getAttribute("data-deldoc"); }));
          GW.toast("Document retiré du dossier");
          GW.render();
        });
      });
    }
  });

  function docForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>🗂 Joindre une pièce</h3><form id='ws-doc-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Titre", GW.input("titre", "", "Ex : contrat signé, justificatif URSSAF…")) +
      GW.formRow("Type", GW.select("type", ["Contrat", "Justificatif", "Facture fournisseur", "Courrier", "Note interne", "Autre"])) +
      GW.formRow("Pièce jointe (photo/scan)", "<input type='file' name='fichier' accept='image/*,.pdf'>") +
      GW.formRow("Note", GW.textarea("note", "", "Contexte de la pièce…", 2)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    var file = $("#ws-doc-form input[type=file]");
    file.addEventListener("change", function () {
      var f = file.files[0];
      if (!f) return;
      var spl = new FileReader();
      spl.onload = function () {
        GW.save("ws_doc_temp", spl.result);
        GW.toast("Pièce chargée (compressée)");
        compressLocal(spl.result, function (out) { GW.save("ws_doc_temp", out); });
      };
      spl.readAsDataURL(f);
    });
    function compressLocal(dataUrl, cb) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 900 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        try { c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); } catch (e) {}
        var out;
        try { out = c.toDataURL("image/jpeg", 0.7); } catch (e) { out = dataUrl; }
        cb(out);
      };
      img.onerror = function () { cb(dataUrl); };
      img.src = dataUrl;
    }
    $("#ws-doc-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var titre = f.titre.value.trim();
      if (!titre) { GW.toast("Donnez un titre au document"); return; }
      var list = get(K.DOC);
      list.push({ id: uid(), clientId: f.clientId.value || null, date: today(), titre: titre, type: f.type.value, note: f.note.value.trim(), dataUrl: GW.load("ws_doc_temp", null) });
      put(K.DOC, list);
      GW.save("ws_doc_temp", null);
      GW.toast("Pièce rangée dans le dossier");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  /* ==================================================================
     MODULE : REPORTING / ACCOMPAGNEMENT (heures, alertes, rapport)
     ================================================================== */
  var tbReporting = [];
  GW.register({
    id: "reporting",
    cat: "Gestion & Pilotage",
    name: "Reporting & suivi",
    tag: "Heures · Alertes · Rapport mensuel",
    icon: "📊",
    render: function () {
      var heures = filterBy(get(K.H), cid());
      var appels = filterBy(get("ga_appels"), cid());
      var totH = heures.reduce(function (s, x) { return s + (Number(x.heures) || 0); }, 0);
      var totAppels = appels.length;
      var impayes = filterBy(get(K.F), cid()).filter(function (x) { return x.statut === "en_attente"; }).map(function (x) { return docTotals(x.lignes).ttc; }).reduce(function (a, b) { return a + b; }, 0);
      var echs = filterBy(get(K.EC), cid()).filter(function (x) { return x.statut !== "fait"; }).filter(function (x) { return x.date < today(); });

      var hRows = heures.slice().sort(function (a, b) { return (b.mois || "").localeCompare(a.mois || ""); }).map(function (x) {
        var cl = findClient(x.clientId);
        return [esc(x.mois || ""), esc(cl ? clientLabel(cl) : "—"), Number(x.heures) || 0, GW.monRight((Number(x.heures) || 0) * (Number(x.tarif) || 45)), GW.badge(x.statut === "facture" ? "Facturé" : "À facturer", x.statut === "facture" ? "ok" : "warn"), x.commandes || ""];
      });
      var alertRows = [];
      if (impayes > 0) alertRows.push(["⚠️", "Impays", "Factures en attente pour " + fmtMoney(impayes), "warn"]);
      echs.forEach(function (x) { alertRows.push(["🔔", "Échéance dépassée", esc(x.type) + " prévue le " + fmtDate(x.date), "warn"]); });
      if (!alertRows.length) alertRows.push(["✅", "OK", "Aucune alerte pour ce client.", "ok"]);
      var totMontant = heures.reduce(function (s, x) { return s + (Number(x.heures) || 0) * (Number(x.tarif) || 45); }, 0);
      var hFoot = ["<b>Total</b>", "", totH, GW.monRight(totMontant), "", ""];
      tbReporting = [
        { action: "add-h", label: "＋ Noter des heures", fn: function () { heuresForm(); } },
        { action: "pdf-report", label: "Rapport mensuel (PDF)", fn: function () { printReport(); } }
      ];;

      return noClientNote() +
        "<div class='ws-kpis'>" +
        GW.kpi("Heures cumulées", totH + " h", "accompagnement") +
        GW.kpi("Appels traités", totAppels, "secrétariat") +
        GW.kpi("Impayés", fmtMoney(impayes), "à encaisser", "warn") +
        "</div>" +
        GW.toolbar(tbReporting) +
        "<div class='ws-panel'><h3>🔔 Alertes</h3>" + GW.tableHTML(["", "Type", "Détail", ""], alertRows.map(function (a) { return [a[0], "<b>" + esc(a[1]) + "</b>", esc(a[2]), GW.badge(a[3] === "warn" ? "ATTENTION" : "OK", a[3] === "warn" ? "warn" : "ok")]; })) + "</div>" +
        "<div class='ws-panel'><h3>⏱ Heures d'accompagnement (formules modulables)</h3>" + GW.tableHTML(["Mois", "Client", "Heures", "Montant (45 €/h)", "Statut", "Commandes"], hRows, "Aucune heure notée.", hFoot) + "</div>";
    },
    afterRender: function () {
      GW.bindToolbar(tbReporting);
      $$("[data-delh]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () { put(K.H, get(K.H).filter(function (x) { return x.id !== b.getAttribute("data-delh"); })); GW.render(); });
      });
    }
  });

  function heuresForm() {
    var main = $("#admin-main");
    var mois = (today() || "").slice(0, 7);
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>⏱ Noter des heures</h3><form id='ws-h-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Mois (AAAA-MM)", GW.input("mois", mois, "")) +
      GW.formRow("Heures", GW.money("heures")) +
      GW.formRow("Commandes / notes", GW.input("commandes", "", "Ex : 6 h admin + 1 h réseaux")) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-h-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!(Number(f.heures.value) > 0)) { GW.toast("Indiquez un nombre d'heures"); return; }
      var list = get(K.H);
      list.push({ id: uid(), clientId: f.clientId.value || null, mois: f.mois.value.trim() || mois, heures: Number(f.heures.value) || 0, commandes: f.commandes.value.trim(), statut: "attente", tarif: 45 });
      put(K.H, list);
      GW.toast("Heures notées");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  function printReport() {
    var cl = GW.selectedClient();
    var heures = filterBy(get(K.H), cid());
    var F = filterBy(get(K.F), cid());
    var appels = filterBy(get("ga_appels"), cid());
    var relances = filterBy(get(K.R), cid());
    var totH = heures.reduce(function (s, x) { return s + (Number(x.heures) || 0); }, 0);
    var facture = F.reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var encaisse = F.filter(function (x) { return x.statut === "payee"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var body =
      "<h3 style='text-transform:uppercase;font-size:12px;letter-spacing:.12em;color:#1b3358;'>Rapport d'accompagnement · " + esc(cl ? clientLabel(cl) : "global") + "</h3>" +
      "<p style='font-size:12px;color:#5b6b7b;'>Édité le " + fmtDate(today()) + "</p>" +
      "<table class='ps-table'><tr><td>Heures d'accompagnement</td><td class='right'>" + totH + " h</td></tr>" +
      "<tr><td>Total facturé</td><td class='right'>" + fmtMoney(facture) + "</td></tr>" +
      "<tr><td>Encaissé</td><td class='right'>" + fmtMoney(encaisse) + "</td></tr>" +
      "<tr><td>Reste à encaisser</td><td class='right'>" + fmtMoney(facture - encaisse) + "</td></tr>" +
      "<tr><td>Appels traités</td><td class='right'>" + appels.length + "</td></tr>" +
      "<tr><td>Relances émises</td><td class='right'>" + relances.length + "</td></tr></table>" +
      "<table class='ps-table' style='margin-top:12px;'><thead><tr><th>Mois</th><th>Heures</th><th>Montant</th></tr></thead><tbody>" +
      heures.map(function (x) { return "<tr><td>" + esc(x.mois) + "</td><td>" + (Number(x.heures) || 0) + "</td><td class='right'>" + fmtMoney((Number(x.heures) || 0) * 45) + "</td></tr>"; }).join("") +
      "</tbody></table>";
    GW.printHTML("Reporting", body);
  }

}(window.GestWorkspace));