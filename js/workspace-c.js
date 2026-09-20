/* ============================================================
   GestAffaires – Espace de travail · Modules DIGITAL & SERVICES
   workspace-c.js
   Modules : Communication, Acquisition, Secrétariat, IA.
   ============================================================ */
(function (GW) {
  "use strict";

  if (!GW) return;

  var esc = GW.esc, fmtMoney = GW.fmtMoney, fmtDate = GW.fmtDate;
  var today = GW.today, uid = GW.uid;
  var get = GW.get, put = GW.put, findClient = GW.findClient, clientLabel = GW.clientLabel;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var adminMain = function () { return document.getElementById("admin-main"); };

  var K = {
    PLANIF: "ga_planif", PROSP: "ga_prospects", CAMP: "ga_campagnes",
    APPELS: "ga_appels", RDV: "ga_rdv", IA: "ga_ia"
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
    return "<p class='ws-hint' style='max-width:760px;'>Sélectionnez un client ci-dessus pour ne voir que ses données.</p>";
  }

  /* ==================================================================
     MODULE : COMMUNICATION (planificateur + contenus + visuels + GBP)
     ================================================================== */
  var CANAUX = ["Facebook", "Instagram", "LinkedIn", "Google Business", "Newsletter", "Autre"];
  var THEMES = ["Info / actualité", "Conseil métier", "Promotion / offre", "Témoignage client", "Coulisses", "Événement"];
  var tbCom = [];
  var tbAcq = [];
  var tbSec = [];

  function mediaChoices() {
    var medias = get("ga_media");
    return [{ v: "", l: "Aucun visuel" }].concat(medias.map(function (m) {
      return { v: m.id, l: m.name };
    }));
  }

  GW.register({
    id: "communication",
    cat: "Digital & Communication",
    name: "Communication",
    tag: "Planificateur · Contenus · Visuels · Google Business",
    icon: "📣",
    render: function () {
      var planif = filterBy(get(K.PLANIF), cid()).slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
      var pRows = planif.map(function (x) {
        var cl = findClient(x.clientId);
        var ok = x.statut === "publie";
        return [fmtDate(x.date), esc(cl ? clientLabel(cl) : "—"), esc(x.canal || ""), esc(x.type || ""), "<div class='ws-txt' style='max-width:380px;'>" + esc(x.contenu || "") + "</div>", GW.badge(ok ? "Publié" : "Prévu", ok ? "ok" : "warn"), "<div class='row-actions'><button class='mini-btn ok' data-pub='" + x.id + "'>" + (ok ? "Dépublier" : "Marquer publié") + "</button><button class='mini-btn danger' data-delp='" + x.id + "'>✕</button></div>"];
      });
      tbCom = [
        { action: "gen-post", label: "＋ Générer un contenu", fn: function () { postForm(); } },
        { action: "xls-planif", label: "Exporter le calendrier (Excel)", fn: function () {
          GW.exportExcel("calendrier-communication-" + today() + ".xls", {
            head: ["Date", "Client", "Canal", "Type", "Contenu", "Visuel", "Statut"],
            body: filterBy(get(K.PLANIF), cid()).map(function (x) { return [x.date, x.clientId ? clientLabel(findClient(x.clientId)) : "", x.canal, x.type, x.contenu, x.mediaName || "", x.statut]; })
          });
        } },
        { action: "pdf-planif", label: "Calendrier imprimable", fn: function () {
          GW.printHTML("Planning de communication",
            "<h3 style='text-transform:uppercase;font-size:12px;letter-spacing:.12em;color:#1b3358;'>Publications · " + esc(cname()) + "</h3>" +
            "<table class='ps-table'><thead><tr><th>Date</th><th>Canal</th><th>Type</th><th>Contenu</th><th>Statut</th></tr></thead><tbody>" +
            filterBy(get(K.PLANIF), cid()).map(function (x) { return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(x.canal) + "</td><td>" + esc(x.type) + "</td><td>" + esc(x.contenu) + "</td><td>" + esc(x.statut === "publie" ? "Publié" : "Prévu") + "</td></tr>"; }).join("") +
            "</tbody></table>");
        } }
      ];
      return noClientNote() +
        GW.toolbar(tbCom) +
        "<div class='ws-panel'><h3>🗓 Planification des publications</h3>" + GW.tableHTML(["Date", "Client", "Canal", "Type", "Contenu", "Statut", "Actions"], pRows, "Aucune publication planifiée. Utilisez « Générer un contenu ».") + "</div>";
    },
    afterRender: function () {
      GW.bindToolbar(tbCom);
      $$("[data-pub]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-pub");
          put(K.PLANIF, get(K.PLANIF).map(function (x) { return x.id === id ? Object.assign({}, x, { statut: x.statut === "publie" ? "attente" : "publie" }) : x; }));
          GW.render();
        });
      });
      $$("[data-delp]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          put(K.PLANIF, get(K.PLANIF).filter(function (x) { return x.id !== b.getAttribute("data-delp"); }));
          GW.toast("Publication supprimée");
          GW.render();
        });
      });
    }
  });

  function postForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📣 Nouveau contenu</h3><form id='ws-post-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Date de publication", GW.input("date", today(), "", "type='date'")) +
      GW.formRow("Canal", GW.select("canal", CANAUX)) +
      GW.formRow("Type de contenu", GW.select("type", THEMES)) +
      GW.formRow("Message (optionnel, laissez vide pour générer)", GW.textarea("contenu", "", "Ex : notre salon de coiffure rouvre à 9 h…", 4) + "<span class='ws-hint' id='post-count'>0 caractère · 0 mot</span>") +
      GW.formRow("Visuel (pense-bête)", GW.select("media", mediaChoices())) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer au calendrier</button>" +
      "<button class='admin-btn admin-btn-ghost' type='button' data-gen>🎛 Générer avec l'IA</button>" +
      "<button class='admin-btn admin-btn-ghost' type='button' data-svg>🎨 Créer un visuel</button></div></form></div>";
    var txt = $("#ws-post-form textarea");
    var pc = $("#post-count");
    if (txt && pc) {
      var updCount = function () {
        var words = txt.value.trim() ? txt.value.trim().split(/\s+/).length : 0;
        pc.textContent = txt.value.length + " caractère(s) · " + words + " mot(s)";
      };
      txt.addEventListener("input", updCount);
      updCount();
    }
    $("[data-gen]").addEventListener("click", function () {
      var cl2 = GW.findClient($("#ws-post-form [name=clientId]").value);
      GW.save("ws_ia_pending", JSON.stringify({ what: "post", ctx: { client: cl2 ? clientLabel(cl2) : "", canal: $("#ws-post-form [name=canal]").value, type: $("#ws-post-form [name=type]").value } }));
      openIA("post");
    });
    $("[data-svg]").addEventListener("click", function () { makeVisual(); });
    $("#ws-post-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var contenu = f.contenu.value.trim();
      if (!contenu) contenu = defaultContenu(f.type.value, GW.findClient(f.clientId.value));
      var list = get(K.PLANIF);
      list.push({ id: uid(), clientId: f.clientId.value || null, date: f.date.value || today(), canal: f.canal.value, type: f.type.value, contenu: contenu, mediaId: f.media.value || null, mediaName: mediaNameOf(f.media.value), statut: "attente" });
      put(K.PLANIF, list);
      GW.toast("Publication planifiée");
      GW.render();
    });
  }
  function mediaNameOf(id) {
    if (!id) return "";
    var m = get("ga_media").filter(function (x) { return x.id === id; })[0];
    return m ? m.name : "";
  }
  function openIA(what) {
    var pend = GW.load("ws_ia_pending", null);
    if (!pend || pend.what !== what) {
      GW.save("ws_ia_pending", JSON.stringify({ what: what, ctx: {} }));
    }
    GW.openModule("ia");
  }
  function defaultContenu(type, cl) {
    var n = cl ? clientLabel(cl) : "Notre entreprise";
    var base = [
      "💡 INFO\n" + n + " : une bonne nouvelle ! Nous vous annonçons la sortie de notre nouvelle prestation. Contactez-nous pour en savoir plus.\n📞 06 12 34 56 78",
      "🛠 CONSEIL\n" + n + " vous partage un conseil métier à appliquer dès aujourd'hui : ne négligez jamais l'entretien de base — c'est ce qui fait la différence sur la durée.\n💬 Et vous, qu'est-ce qui marche chez vous ?",
      "🎁 OFFRE\n" + n + " vous propose une offre spéciale limitée ! Profitez-en vite, places limitées.\n👉 Contactez-nous au 06 12 34 56 78",
      "⭐ TÉMOIGNAGE\n« Un service impeccable et des équipes à l'écoute. » — un client de " + n + ".\nMerci pour votre confiance !",
      "👀 COULISSES\nCoup d'œil dans les coulisses de " + n + " ! On prépare soigneusement votre prochaine visite.\nRendez-vous très vite !",
      "📅 ÉVÉNEMENT\n" + n + " organise un événement ! Notez la date et venez nombreux.\n📞 Inscription au 06 12 34 56 78"
    ];
    var idx = THEMES.indexOf(type);
    return base[Math.max(0, idx)];
  }

  function makeVisual() {
    var main = $("#admin-main");
    var cl = GW.selectedClient();
    var themeCols = ["#0CB5A6", "#6A4CE0", "#FF7A59", "#2E86AB"];
    var col = themeCols[Math.floor(Math.random() * themeCols.length)];
    var name = cl ? clientLabel(cl) : "Votre entreprise";
    var intro = cl ? (cl.company || cl.email || "Gestion · Administration · Digital") : "Gestion · Administration · Digital";
    var msg = "Merci de votre confiance !";
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1080' viewBox='0 0 1080 1080'>" +
      "<rect width='1080' height='1080' fill='#0B1B33'/>" +
      "<rect x='40' y='40' width='1000' height='1000' rx='40' fill='#ffffff'/>" +
      "<rect x='120' y='120' width='840' height='70' rx='14' fill='" + col + "'/>" +
      "<circle cx='180' cy='155' r='30' fill='#0B1B33'/><text x='180' y='166' font-family='Arial' font-size='34' font-weight='bold' fill='#0CB5A6' text-anchor='middle'>G</text>" +
      "<text x='235' y='170' font-family='Arial' font-size='38' font-weight='bold' fill='#0B1B33'>GestAffaires</text>" +
      "<text x='120' y='320' font-family='Arial' font-size='64' font-weight='bold' fill='#0B1B33'>" + stripXml(name) + "</text>" +
      "<text x='120' y='392' font-family='Arial' font-size='36' fill='" + col + "'>" + stripXml(intro) + "</text>" +
      "<rect x='120' y='460' width='840' height='4' fill='#E3EAF4'/>" +
      "<text x='120' y='560' font-family='Arial' font-size='44' fill='#1B3358'>" + stripXml(msg) + "</text>" +
      "<text x='120' y='920' font-family='Arial' font-size='30' fill='#8a98a8'>06 12 34 56 78 · gestaffaires45@gmail.com</text>" +
      "<rect x='760' y='860' width='160' height='60' rx='16' fill='" + col + "'/><text x='840' y='892' font-family='Arial' font-size='28' fill='#fff' text-anchor='middle'>Découvrir</text>" +
      "</svg>";
    var dataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>🎨 Visuel généré</h3>" +
      "<p class='ws-hint'>Un visuel 1080×1080 (format carré réseaux sociaux). Téléchargez-le en SVG puis convertissez ou utilisez directement. « Ouvrir » l'affiche dans un onglet pour l'exporter en image.</p>" +
      "<div class='ws-visual-pre'><img src='" + dataUrl + "' alt='Aperçu du visuel'></div>" +
      "<div class='ws-actions'>" +
      "<button class='admin-btn' data-svg-dl>Télécharger .svg</button>" +
      "<a class='admin-btn admin-btn-ghost' href='" + dataUrl + "' download='visuel-" + stripXml(name).replace(/\s+/g, "-") + ".svg' style='text-decoration:none;display:inline-block;line-height:inherit;'>Enregistrer le fichier</a>" +
      "<button class='admin-btn admin-btn-ghost' data-svg-back>Retour</button></div></div>";
    $("[data-svg-dl]").addEventListener("click", function () {
      var b = new Blob([svg], { type: "image/svg+xml" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "visuel-" + stripXml(name).replace(/\s+/g, "-") + ".svg";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 300);
      GW.toast("Visuel téléchargé (SVG)");
    });
    $("[data-svg-back]").addEventListener("click", function () { GW.render(); });
  }
  function stripXml(s) {
    return String(s || "").replace(/[<>&"']/g, "");
  }

  /* ==================================================================
     MODULE : ACQUISITION (prospects + campagne Ads)
     ================================================================== */
  var PSTAT = ["nouveau", "contacte", "rdv", "gagne", "perdu"];
  var PLAB = { nouveau: "Nouveau", contacte: "Contacté", rdv: "Rendez-vous", gagne: "Gagné", perdu: "Perdu" };

  GW.register({
    id: "acquisition",
    cat: "Digital & Communication",
    name: "Acquisition",
    tag: "Prospects · Campagnes Ads · Budget",
    icon: "🎯",
    render: function () {
      var pr = filterBy(get(K.PROSP), cid()).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var camp = filterBy(get(K.CAMP), cid());
      var gagnes = pr.filter(function (x) { return x.statut === "gagne"; }).length;
      var enCours = pr.filter(function (x) { return x.statut === "nouveau" || x.statut === "contacte"; }).length;
      var budgetTotal = camp.reduce(function (s, x) { return s + (Number(x.budget) || 0); }, 0);
      var clicsTotal = camp.reduce(function (s, x) { return s + (Number(x.clics) || 0); }, 0);
      var convTotal = camp.reduce(function (s, x) { return s + (Number(x.conv) || 0); }, 0);
      var cpcMoy = clicsTotal > 0 ? budgetTotal / clicsTotal : 0;

      var pRows = pr.map(function (x) {
        var cl = findClient(x.clientId);
        var lbl = PLAB[x.statut] || x.statut;
        var kind = x.statut === "gagne" ? "ok" : x.statut === "perdu" ? "danger" : x.statut === "rdv" ? "warn" : "grey";
        var act = "<button class='mini-btn' data-pst='" + x.id + "'>Suivant +</button> <button class='mini-btn danger' data-pdel='" + x.id + "'>✕</button>";
        if (x.statut === "gagne") act = "<button class='mini-btn ok' data-adopt='" + x.id + "'>⇢ Client</button> " + act;
        return [fmtDate(x.date), esc(cl ? clientLabel(cl) : "—"), esc(x.nom || ""), esc(x.societe || ""), esc(x.src || ""), esc(x.tel || ""), GW.badge(lbl, kind), act];
      });
      var cRows = camp.map(function (x) {
        var cl = findClient(x.clientId);
        return [esc(x.nom || ""), esc(cl ? clientLabel(cl) : "—"), GW.monRight(x.budget), Number(x.impressions) || 0, Number(x.clics) || 0, (Number(x.clics) && Number(x.impressions)) ? Math.round(Number(x.clics) / Number(x.impressions) * 100) + " %" : "—", GW.monRight((Number(x.clics) || 0) * (Number(x.cpc) || 0)), "<button class='mini-btn danger' data-cdel='" + x.id + "'>✕</button>"];
      });
      tbAcq = [
        { action: "add-prosp", label: "＋ Ajouter un prospect", fn: function () { prospForm(); } },
        { action: "add-camp", label: "＋ Nouvelle campagne", fn: function () { campForm(); } },
        { action: "xls-acq", label: "Exporter (Excel)", fn: function () {
          GW.exportExcel("acquisition-" + today() + ".xls", {
            head: ["Date", "Client", "Prospect", "Société", "Source", "Téléphone", "Statut"],
            body: filterBy(get(K.PROSP), cid()).map(function (x) { return [x.date, x.clientId ? clientLabel(findClient(x.clientId)) : "", x.nom, x.societe, x.src, x.tel, PLAB[x.statut] || x.statut]; })
          });
        } }
      ];
      return noClientNote() +
        "<div class='ws-kpis'>" +
        GW.kpi("Prospects", pr.length, enCours + " à traiter") +
        GW.kpi("Gagnés", gagnes, "convertis", "ok") +
        GW.kpi("Budget campagnes", fmtMoney(budgetTotal), clicsTotal + " clics · " + convTotal + " conv.") +
        "</div>" +
        GW.toolbar(tbAcq) +
        "<div class='ws-panel'><h3>👥 Prospects (petit CRM)</h3>" + GW.tableHTML(["Date", "Client", "Nom", "Société", "Source", "Tél.", "Statut", "Actions"], pRows, "Aucun prospect pour le moment.") + "</div>" +
        "<div class='ws-panel'><h3>📈 Campagnes Google Ads (suivi + coût)</h3>" + GW.tableHTML(["Campagne", "Client", "Budget", "Impressions", "Clics", "CTR", "Coût", ""], cRows, "Aucune campagne. Ajoutez une campagne pour la suivre.") + "</div>" +
        "<div class='ws-box'><h4>🧮 Simulateur rapide Ads</h4>" +
        "<div class='ws-form'><div class='ws-frow'><label>Budget mensuel (€)</label><input type='number' id='sim-budget' value='300'></div>" +
        "<div class='ws-frow'><label>Coût par clic (CPC, €)</label><input type='number' id='sim-cpc' step='0.01' value='0.50'></div>" +
        "<div class='ws-frow'><label>Taux de conversion (%)</label><input type='number' id='sim-cv' step='0.1' value='3'></div></div>" +
        "<p class='ws-hint' id='sim-out'>Cliquez sur Calculer pour estimer clics et rendez-vous.</p>" +
        "<button class='mini-btn primary' data-sim>Calculer l'estimation</button></div>";
    },
    afterRender: function () {
      GW.bindToolbar(tbAcq);
      $$("[data-pst]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-pst");
          var list = get(K.PROSP).map(function (x) {
            if (x.id !== id) return x;
            var i = PSTAT.indexOf(x.statut);
            return Object.assign({}, x, { statut: PSTAT[Math.min(i + 1, PSTAT.length - 1)] });
          });
          put(K.PROSP, list);
          GW.render();
        });
      });
      $$("[data-pdel]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          put(K.PROSP, get(K.PROSP).filter(function (x) { return x.id !== b.getAttribute("data-pdel"); }));
          GW.toast("Prospect supprimé");
          GW.render();
        });
      });
      $$("[data-adopt]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var p = get(K.PROSP).filter(function (x) { return x.id === b.getAttribute("data-adopt"); })[0];
          if (!p) return;
          var clients = GW.getClients();
          if (clients.filter(function (c) { return c.name === p.nom && c.phone === p.tel; }).length) { GW.toast("Ce prospect est déjà client"); return; }
          clients.push({ id: uid(), name: p.nom, company: p.societe || "", email: "", phone: p.tel || "", address: "", dispo: "", created: new Date().toISOString() });
          GW.put("ga_clients", clients);
          GW.toast("Prospect converti en client (onglet Clients)");
          GW.render();
        });
      });
      $$("[data-cdel]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          put(K.CAMP, get(K.CAMP).filter(function (x) { return x.id !== b.getAttribute("data-cdel"); }));
          GW.toast("Campagne supprimée");
          GW.render();
        });
      });
      var sim = $("[data-sim]");
      if (sim) sim.addEventListener("click", function () {
        var budget = Number($("#sim-budget").value) || 0;
        var cpc = Number($("#sim-cpc").value) || 0.5;
        var cv = Number($("#sim-cv").value) || 3;
        var clics = cpc > 0 ? Math.round(budget / cpc) : 0;
        var conv = Math.round(clics * cv / 100);
        var imp = clics * 20;
        $("#sim-out").innerHTML = "≈ <b>" + imp + "</b> impressions · <b>" + clics + "</b> clics · <b>" + conv + "</b> conversions attendues · coût moyen par conversion ≈ <b>" + fmtMoney(conv > 0 ? budget / conv : 0) + "</b>";
      });
    }
  });
  function prospForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>👥 Nouveau prospect</h3><form id='ws-prosp-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Nom / prénom *", GW.input("nom", "", "Ex : Marc Rousseau")) +
      GW.formRow("Société / activité", GW.input("societe", "", "Ex : Plomberie Rousseau")) +
      GW.formRow("Téléphone", GW.input("tel", "", "06 00 00 00 00")) +
      GW.formRow("Source", GW.select("src", ["Google", "Google Ads", "Facebook", "Instagram", "Bouche-à-oreille", "Salon / réseau", "Autre"])) +
      GW.formRow("Note", GW.textarea("note", "", "Historique, intentions…", 3)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-prosp-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.nom.value.trim()) { GW.toast("Nom du prospect requis"); return; }
      var list = get(K.PROSP);
      list.push({ id: uid(), clientId: f.clientId.value || null, date: today(), nom: f.nom.value.trim(), societe: f.societe.value.trim(), tel: f.tel.value.trim(), src: f.src.value, note: f.note.value.trim(), statut: "nouveau" });
      put(K.PROSP, list);
      GW.toast("Prospect ajouté");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  function campForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📈 Nouvelle campagne</h3><form id='ws-camp-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Nom de la campagne", GW.input("nom", "", "Ex : Recherche locale – promo rentrée")) +
      GW.formRow("Budget mensuel (€)", GW.money("budget")) +
      GW.formRow("CPC moyen (€)", GW.money("cpc")) +
      GW.formRow("Impressions", GW.money("impressions")) +
      GW.formRow("Clics", GW.money("clics")) +
      GW.formRow("Conversions", GW.money("conv")) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-camp-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var list = get(K.CAMP);
      list.push({ id: uid(), clientId: f.clientId.value || null, nom: f.nom.value.trim(), budget: Number(f.budget.value) || 0, cpc: Number(f.cpc.value) || 0, impressions: Number(f.impressions.value) || 0, clics: Number(f.clics.value) || 0, conv: Number(f.conv.value) || 0, statut: "en_cours" });
      put(K.CAMP, list);
      GW.toast("Campagne enregistrée");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  /* ==================================================================
     MODULE : SECRÉTARIAT (appels, messages, RDV, dispo par client)
     ================================================================== */
  function clientPhone(client) {
    if (!client) return "";
    var seed = 0;
    var s = String(client.id);
    for (var i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 9000000007;
    var h = function (n) { return ("0" + (n % 100)).slice(-2); };
    return "0" + (1 + (seed % 9)) + " " + h(seed >> 2) + " " + h(seed >> 4) + " " + h(seed >> 6) + " " + h(seed >> 8);
  }
  function dispoOf(client) {
    var d = client && (client.dispo || client.disponibilite || "").toString().trim();
    return d || "Selon planning (non renseigné)";
  }

  GW.register({
    id: "secretariat",
    cat: "Services & Accompagnement",
    name: "Secrétariat",
    tag: "Appels · Messages · Rendez-vous · Disponibilité",
    icon: "📞",
    render: function () {
      var appels = filterBy(get(K.APPELS), cid()).slice().sort(function (a, b) { return ((b.date || "") + b.heure || "").localeCompare(((a.date || "") + a.heure || "")); });
      var rdvs = filterBy(get(K.RDV), cid()).slice().sort(function (a, b) { return ((a.date || "") + " " + (a.heure || "")).localeCompare((b.date || "") + " " + (b.heure || "")); });
      var cl = GW.selectedClient();
      var aRows = appels.map(function (x) {
        var c = findClient(x.clientId);
        var traite = x.statut === "traite";
        return [fmtDate(x.date), esc(x.heure || ""), esc(c ? clientLabel(c) : "—"), esc(x.correspondant || ""), esc(x.num || ""), esc(x.motif || ""), esc(x.suite || ""), GW.badge(traite ? "Traité" : "À traiter", traite ? "ok" : "warn"), "<div class='row-actions'><button class='mini-btn ok' data-at='1' data-id='" + x.id + "'>" + (traite ? "Rouvrir" : "Traité") + "</button><button class='mini-btn danger' data-at='2' data-id='" + x.id + "'>✕</button></div>"];
      });
      var rRows = rdvs.map(function (x) {
        var c = findClient(x.clientId);
        return [fmtDate(x.date), esc(x.heure || ""), esc(c ? clientLabel(c) : "—"), esc(x.correspondant || ""), esc(x.motif || ""), "<button class='mini-btn danger' data-rdel='" + x.id + "'>✕</button>"];
      });
      return noClientNote() +
        "<div class='ws-panel'><h3>📶 Lignes téléphoniques par client</h3>" +
        "<p class='ws-hint'>Chaque client dispose d'un numéro qui lui est dédié. Vous répondez sur la plateforme et vous voyez immédiatement <b>quel client</b> appelle. La réception réelle de l'appel se branche via un opérateur télécom (Twilio, Ringover…) — la console ci-dessous gère tout le reste : prise d'appel, message, rendez-vous.</p>" +
        "<table class='ws-table'><thead><tr><th>Client</th><th>Numéro attribué</th><th>Disponibilité</th><th>Appels à traiter</th></tr></thead><tbody>" +
        GW.getClients().map(function (c) {
          var nb = get(K.APPELS).filter(function (a) { return a.clientId === c.id && a.statut !== "traite"; }).length;
          return "<tr><td>" + esc(clientLabel(c)) + "</td><td><b>" + clientPhone(c) + "</b></td><td>" + esc(dispoOf(c)) + "</td><td>" + (nb ? GW.badge(nb + " appel(s)", "warn") : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        (tbSec = [
          { action: "add-appel", label: "＋ Prendre un appel", fn: function () { appelForm(); } },
          { action: "add-rdv", label: "＋ Prendre un rendez-vous", fn: function () { rdvForm(); } },
          { action: "set-dispo", label: "🕐 Définir la disponibilité", fn: function () { dispoForm(); } },
          { action: "xls-appels", label: "Exporter le journal (Excel)", fn: function () {
            GW.exportExcel("journal-appels-" + today() + ".xls", {
              head: ["Date", "Heure", "Client", "Correspondant", "Numéro", "Motif", "Suite", "Statut"],
              body: filterBy(get(K.APPELS), cid()).map(function (x) { return [x.date, x.heure, x.clientId ? clientLabel(findClient(x.clientId)) : "", x.correspondant, x.num, x.motif, x.suite, x.statut]; })
            });
          } }
        ], GW.toolbar(tbSec)) +
        "<div class='ws-panel'><h3>📞 Journal des appels</h3>" + GW.tableHTML(["Date", "Heure", "Client", "Correspondant", "N°", "Motif", "Suite", "État", "Actions"], aRows, "Aucun appel enregistré. Prenez le premier appel pour ouvrir le journal.") + "</div>" +
        "<div class='ws-panel'><h3>📅 Rendez-vous</h3>" + GW.tableHTML(["Date", "Heure", "Client", "Correspondant", "Motif", ""], rRows, "Aucun rendez-vous.") + "</div>";
    },
    afterRender: function () {
      GW.bindToolbar(tbSec);
      $$("[data-at]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id");
          if (b.getAttribute("data-at") === "2") {
            put(K.APPELS, get(K.APPELS).filter(function (x) { return x.id !== id; }));
            GW.toast("Appel supprimé du journal");
          } else {
            put(K.APPELS, get(K.APPELS).map(function (x) { return x.id === id ? Object.assign({}, x, { statut: x.statut === "traite" ? "nouveau" : "traite" }) : x; }));
          }
          GW.render();
        });
      });
      $$("[data-rdel]", adminMain()).forEach(function (b) {
        b.addEventListener("click", function () {
          put(K.RDV, get(K.RDV).filter(function (x) { return x.id !== b.getAttribute("data-rdel"); }));
          GW.toast("Rendez-vous supprimé");
          GW.render();
        });
      });
    }
  });

  function appelForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📞 Prendre un appel</h3><form id='ws-appel-form' class='ws-form'>" +
      GW.formRow("Client (à qui votre client appartient)", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Correspondant *", GW.input("correspondant", "", "Ex : Mme Lefèvre")) +
      GW.formRow("Numéro du correspondant", GW.input("num", "", "06 00 00 00 00")) +
      GW.formRow("Motif de l'appel", GW.textarea("motif", "", "De quoi parle l'appel ?", 3)) +
      GW.formRow("Suite donnée", GW.select("suite", ["Message transmis", "Rappel demandé", "Rendez-vous pris", "Appel transféré", "Information donnée", "À recontacter"])) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer l'appel</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-appel-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.correspondant.value.trim()) { GW.toast("Nom du correspondant requis"); return; }
      var cl = GW.findClient(f.clientId.value);
      var list = get(K.APPELS);
      var now = new Date();
      list.push({ id: uid(), clientId: f.clientId.value || null, date: today(), heure: String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"), correspondant: f.correspondant.value.trim(), num: f.num.value.trim(), motif: f.motif.value.trim(), suite: f.suite.value, statut: "nouveau" });
      put(K.APPELS, list);
      GW.toast("Appel journalé");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  function rdvForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📅 Nouveau rendez-vous</h3><form id='ws-rdv-form' class='ws-form'>" +
      GW.formRow("Client concerné", GW.select("clientId", GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }), cid() || "")) +
      GW.formRow("Date", GW.input("date", today(), "", "type='date'")) +
      GW.formRow("Heure", GW.input("heure", "09:00", "", "type='time'")) +
      GW.formRow("Correspondant", GW.input("correspondant", "", "Ex : M. Dupont")) +
      GW.formRow("Motif", GW.input("motif", "", "Ex : signature devis")) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#ws-rdv-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var list = get(K.RDV);
      list.push({ id: uid(), clientId: f.clientId.value || null, date: f.date.value || today(), heure: f.heure.value || "09:00", correspondant: f.correspondant.value.trim(), motif: f.motif.value.trim() });
      put(K.RDV, list);
      GW.toast("Rendez-vous enregistré");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  function dispoForm() {
    var main = $("#admin-main");
    main.querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>🕐 Disponibilité par client</h3><form id='ws-dispo-form' class='ws-form'>" +
      "<p class='ws-hint'>Indiquez, pour chaque client, à quels horaires leurs correspondants peuvent être rappelés.</p>" +
      GW.getClients().map(function (c) {
        return "<div class='ws-frow'><label>" + esc(clientLabel(c)) + "</label><input name='dispo_" + c.id + "' value='" + esc(dispoOf(c)) + "' placeholder='Ex : lun-ven 8h-12h / 14h-17h'></div>";
      }).join("") +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    var f = $("#ws-dispo-form");
    $("[data-back]").addEventListener("click", function () { GW.render(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ff = e.target;
      var list = GW.getClients().map(function (c) {
        var v = $("#ws-dispo-form [name='dispo_" + c.id + "']").value.trim();
        return Object.assign({}, c, { dispo: v });
      });
      GW.put("ga_clients", list);
      GW.toast("Disponibilités enregistrées");
      GW.render();
    });
  }

  /* ==================================================================
     MODULE : ASSISTANT IA (Google Gemini – clé optionnelle)
     ================================================================== */
  var presets = {
    post: "Rédige une publication pour {canal} au nom de l'entreprise « {client} » (type : {type}). Ton : proche, simple, efficace, sans emojis excessifs. 3 à 5 phrases, avec appel à l'action et contact. Donne uniquement le texte de la publication.",
    relance: "Rédige une relance de paiement polie mais ferme (1er niveau, J+7) au nom d'un prestataire de gestion pour son client entreprise « {client} ». 3 phrases maximum.",
    gbp: "Rédige la description Google Business Profile (750 caractères max) de l'entreprise « {client} », ton professionnel, local, avec les prestations clés et un appel à l'action.",
    livre: "Propose 5 idées de publications mensuelles pour les réseaux sociaux de « {client} » : une par semaine, avec visuel et hashtags.",
    mail: "Rédige un e-mail de bienvenue pour un nouveau client « {client} » géré par un service de gestion administrative et digitale."
  };

  GW.register({
    id: "ia",
    cat: "Services & Accompagnement",
    name: "Assistant IA",
    tag: "Clé Gemini · Rédaction assistée",
    icon: "🤖",
    render: function () {
      var cfg = GW.load(K.IA, {});
      var hasKey = !!(cfg.key && cfg.key.length > 15);
      var cl = GW.selectedClient();
      var pend = JSON.parse(GW.load("ws_ia_pending", "null") || "null");
      var what = pend && pend.what ? pend.what : "post";
      var pendingCtx = pend ? pend.ctx : {};
      var etat = hasKey
        ? GW.badge("Clé configurée", "ok")
        : GW.badge("Clé manquante", "warn");
      function ctxVal(k, def) {
        return pendingCtx && pendingCtx[k] != null ? pendingCtx[k] : def;
      }
      var tpl = (presets[what] || presets.post)
        .replace("{canal}", esc(ctxVal("canal", "Facebook")))
        .replace("{client}", esc(ctxVal("client", cl ? clientLabel(cl) : "l'entreprise")))
        .replace("{type}", esc(ctxVal("type", "Info / actualité")));
      if (what === "gbp") tpl = (presets.gbp).replace("{client}", esc(ctxVal("client", cl ? clientLabel(cl) : "l'entreprise")));
      return noClientNote() +
        "<div class='ws-panel'><h3>🤖 Assistant IA “ On rédige pour vous ”</h3>" +
        "<p class='ws-hint'>Fonctionne avec la clé API <b>Google Gemini</b> (gratuite pour un usage modéré : aistudio.google.com/apikey). La clé reste stockée sur votre appareil (never envoyée nulle part ailleurs). Sans clé, le module indique seulement les étapes + suggestions.</p>" +
        "<div class='ws-form'>" +
        GW.formRow("Clé API Gemini", GW.input("ia_key", cfg.key || "", "Pastez votre clé AI…", "type='password'")) +
        GW.formRow("Modèle", GW.select("ia_model", ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"], cfg.model || "gemini-2.0-flash")) +
        GW.formRow("Type de rédaction", GW.select("ia_what", [
          { v: "post", l: "Publication réseaux sociaux" },
          { v: "relance", l: "Relance de paiement" },
          { v: "gbp", l: "Description Google Business" },
          { v: "livre", l: "Plan de publication mensuel" },
          { v: "mail", l: "E-mail de bienvenue client" }
        ], what)) +
        GW.formRow("Consigne", GW.textarea("ia_prompt", tpl, "La consigne envoyée à l'IA…", 4) + "<span class='ws-hint' id='ia-count'></span>") +
        "</div>" +
        "<div class='ws-actions'>" +
        "<button class='admin-btn' data-ia-save>💾 Enregistrer la clé</button>" +
        "<button class='admin-btn' data-ia-test>🔍 Tester la clé</button>" +
        "<button class='admin-btn primary' data-ia-run>" + (hasKey ? "🤖 Générer maintenant" : "🤖 Tester sans clé (hors-ligne)") + "</button></div>" +
        "<div id='ia-out' class='ws-box' style='margin-top:14px;'>" + (hasKey ? "" : "<h4>Comment obtenir la clé</h4><ol class='ws-list'><li>Allez sur aistudio.google.com/apikey</li><li>Créez une clé (gratuite)</li><li>Collez-la ci-dessus puis cliquez « Enregistrer la clé »</li></ol>") + "</div></div>";
    },
    afterRender: function () {
      $("[data-ia-save]").addEventListener("click", saveIAKey);
      $("[data-ia-test]").addEventListener("click", testIAKey);
      $("[data-ia-run]").addEventListener("click", runIA);
      var ip = $("[name=ia_prompt]"), ic = $("#ia-count");
      if (ip && ic) {
        var upd = function () { ic.textContent = ip.value.length + " caractère(s) dans la consigne"; };
        ip.addEventListener("input", upd);
        upd();
      }
    }
  });

  function saveIAKey() {
    var el = $("[name=ia_key]");
    var key = el ? el.value.trim() : "";
    var mod = $("[name=ia_model]");
    GW.save(K.IA, { key: key, model: mod ? mod.value : "gemini-2.0-flash" });
    GW.toast(key ? "Clé enregistrée" : "Clé effacée");
    GW.render();
  }

  function testIAKey() {
    var el = $("[name=ia_key]");
    var key = (el && el.value.trim()) || GW.load(K.IA, {}).key || "";
    var mod = $("[name=ia_model]");
    var model = mod ? mod.value : "gemini-2.0-flash";
    var out = $("#ia-out");
    if (!key) { GW.toast("Collez d'abord votre clé Gemini"); return; }
    out.innerHTML = "<p class='ws-hint'>🔍 Vérification de la clé…</p>";
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Réponds uniquement : OK" }] }] })
    }).then(function (r) { return r.json(); }).then(function (data) {
      var txt = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!txt) {
        var er = data && data.error;
        out.innerHTML = "<p class='ws-hint' style='color:#b3423a;'>❌ Clé refusée — " + esc(er && (er.message || er.status) || "réponse vide") + "</p>";
        if (er && /API_KEY|KEY|invalid|INVALID/.test(er.message || "|" + er.status)) {
          out.innerHTML += "<p class='ws-hint'>Vérifiez la clé sur aistudio.google.com/apikey puis collez-la au-dessus. Les clés commencent généralement par « AIza ».</p>";
        }
        return;
      }
      GW.toast("Clé valide ✓");
      out.innerHTML = "<p class='ws-hint' style='color:#0b7a46;'>✅ Clé valide ! Réponse du modèle « " + esc(model) + " » : " + esc(txt) + "</p>" +
        "<p class='ws-hint'>Cliquez sur « 💾 Enregistrer la clé » puis « 🤖 Générer maintenant » pour rédiger votre contenu.</p>";
    }).catch(function (e) {
      out.innerHTML = "<p class='ws-hint' style='color:#b3423a;'>❌ Erreur réseau : " + esc(e.message) + "</p>";
    });
  }

  function runIA() {
    var prop = $("[name=ia_prompt]");
    var what = $("[name=ia_what]");
    var cfg = GW.load(K.IA, {});
    var prompt = prop ? prop.value.trim() : "";
    if (!prompt) { GW.toast("Consigne vide"); return; }
    var out = $("#ia-out");
    if (!cfg.key) {
      /* mode hors-ligne : réponse basée sur des modèles */
      var base = "🤖 (Hors-ligne, sans clé) Voici une ébauche à personnaliser :\n\n";
      var offline = "";
      if (what && what.value === "relance") {
        offline = base + "Bonjour,\nNous revenons vers vous au sujet de la facture en attente. Nous restons disponibles pour toute question et vous remercions de votre règlement prochain.\nCordialement";
      } else {
        offline = base + "Bonjour à tous ! Une nouveauté à découvrir chez nous. Contactez-nous pour en savoir plus.\n\n👉 Astuce : ajoutez votre clé Gemini pour une rédaction personnalisée et complète.";
      }
      GW.save("ws_ia_last", offline);
      out.innerHTML = "<div class='ws-actions'><button class='mini-btn' data-ia-copy>📋 Copier</button></div>" +
        "<pre class='ws-pre'>" + esc(offline) + "</pre>";
      $("[data-ia-copy]").addEventListener("click", function () { GW.copyText(offline); });
      return;
    }
    out.innerHTML = "<p class='ws-hint'>🤖 Génération en cours…</p>";
    var body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.model || "gemini-2.0-flash") + ":generateContent?key=" + encodeURIComponent(cfg.key);
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var txt = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
        if (!txt) {
          if (data && data.error) {
            out.innerHTML = "<p class='ws-empty'>Erreur API : " + esc(data.error.message || data.error.status) + "</p>";
          } else {
            out.innerHTML = "<p class='ws-empty'>Pas de réponse (vérifiez votre clé / modèle).</p>";
          }
          return;
        }
        out.innerHTML = "<div class='ws-actions'><button class='mini-btn' data-ia-copy>📋 Copier</button><button class='mini-btn' data-ia-add>＋ Ajouter au calendrier (pub)</button></div>" +
          "<pre class='ws-pre'>" + esc(txt) + "</pre>";
        GW.save("ws_ia_last", txt);
        $("[data-ia-copy]").addEventListener("click", function () { GW.copyText(txt); });
        var add = $("[data-ia-add]");
        if (add) add.addEventListener("click", function () {
          var list = get(K.PLANIF);
          list.push({ id: uid(), clientId: GW.currentClientId() || null, date: today(), canal: what ? what.value : "Facebook", type: "IA généré", contenu: txt, statut: "attente" });
          put(K.PLANIF, list);
          GW.toast("Ajouté au calendrier de communication");
          GW.openModule("communication");
        });
      })
      .catch(function (e) { out.innerHTML = "<p class='ws-empty'>Erreur réseau : " + esc(e.message) + "</p>"; });
  }

}(window.GestWorkspace));