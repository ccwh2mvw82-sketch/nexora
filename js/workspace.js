/* ============================================================
   GestAffaires – Espace de travail · Missions client
   Votre métier : gestion administrative & digitale pour vos
   clients (TPE/PME). Chaque mission prépare le livrable final
   pour UN client (choisi dans vos fiches ou saisi à la main) :
   dossiers, facturation & relances, déclarations, classement,
   trésorerie, reporting, Google Business, réseaux sociaux,
   contenus & visuels, newsletters.
   Tout reste local (localStorage). Pour ce qui exige les API
   Meta/Google : le pack complet est généré, vous n'avez qu'à
   déposer les contenus sur le compte du client.
   ============================================================ */

window.GestWorkspace = (function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var LS_TOOLS = "ga_tools";
  var LS_MEDIA = "ga_media";
  var LS_CLIENTS = "ga_clients";
  var LS_FACTURES = "ga_factures";
  var LS_DEVIS = "ga_devis";
  var LS_CONTRATS = "ga_contrats";

  var adminMain = function () { return $("#admin-main"); };

  var state = { tool: null, step: 0, inputs: {}, resultHtml: null, resultMeta: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }
  function load(key, def) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function getTools() { return load(LS_TOOLS, {}); }
  function setTools(t) { save(LS_TOOLS, t); }
  function getClients() { return load(LS_CLIENTS, []); }
  function today() {
    var d = new Date(), m = String(d.getMonth() + 1).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ==================================================================
     BIBLIOTHÈQUE MÉDIA (photos / logos, upload local, compressé)
     ================================================================== */
  function getMedia() { return load(LS_MEDIA, []); }
  function setMedia(m) { save(LS_MEDIA, m); }
  function mediaName(file) {
    return (file && file.name) ? file.name.replace(/\.(png|jpe?g|webp|gif)$/i, "") : "Photo";
  }
  function readFileAsDataURL(file, cb) {
    var r = new FileReader();
    r.onload = function () { cb(r.result); };
    r.onerror = function () { cb(null); };
    r.readAsDataURL(file);
  }
  function compressImage(dataUrl, maxDim, quality, cb) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      try { ctx.drawImage(img, 0, 0, w, h); } catch (e) {}
      var out;
      try { out = c.toDataURL("image/jpeg", quality); } catch (e) { out = dataUrl; }
      cb(out, w, h);
    };
    img.onerror = function () { cb(dataUrl, 0, 0); };
    img.src = dataUrl;
  }
  function addMedia(file, cb) {
    readFileAsDataURL(file, function (dataUrl) {
      if (!dataUrl) { cb(null); return; }
      compressImage(dataUrl, 1080, 0.82, function (compressed) {
        var list = getMedia();
        if (list.length >= 12) { cb(null); return; }
        var item = { id: "m" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: mediaName(file), dataUrl: compressed };
        list.push(item);
        setMedia(list);
        cb(item);
      });
    });
  }
  function removeMedia(id) {
    setMedia(getMedia().filter(function (m) { return m.id !== id; }));
  }
  function mediaById(id) {
    var found = getMedia().filter(function (m) { return m.id === id; })[0];
    return found || null;
  }
  function stripAcc(s) {
    try { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
    catch (e) { return String(s || ""); }
  }

  /* ==================================================================
     VIDÉO : consignes honnêtes (pas de montage vidéo local fiable)
     ================================================================== */
  function videoNote() {
    return '<div class="ws-box" style="border-color:#8b6bff;background:#f7f5ff;">' +
      '<h4>🎬 À propos des vidéos</h4>' +
      "<p>Le montage vidéo automatisé demande un outil professionnel (hors navigateur). GestAffaires prépare le <b>découpage</b>, le <b>script</b> et les <b>consignes</b> — il reste à filmer chaque plan avec un téléphone, puis à coller les plans selon le découpage fourni (montage simple en 10 min dans la galerie photo).</p></div>";
  }

  /* ==================================================================
     MISSIONS CLIENT : définition (étapes + générateur)
     ================================================================== */
  var TOOLS = [];

  /* ---------- 1. Dossier client ---------- */
  TOOLS.push({
    id: "dossier",
    name: "Dossier client",
    desc: "Ouvrir ou reprendre le dossier d'un client : pièces à collecter, plan de classement, échéances et courrier de demande.",
    icon: "🗂️",
    payment: false,
    steps: [
      {
        title: "Le client & la société",
        hint: "Choisissez un client (ses infos remplissent les champs) ou saisissez son entreprise.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Nom du client / société *", type: "text", req: true, ph: "ex : Boulangerie Dupont (SARL)" },
          { n: "forme", label: "Forme juridique", type: "select", options: ["Auto-entrepreneur", "EI", "EURL", "SARL", "SASU", "SAS", "Association"], def: "Auto-entrepreneur" },
          { n: "siret", label: "SIRET / RCS", type: "text", ph: "000 000 000 00000" },
          { n: "activite", label: "Activité (une ligne)", type: "text", ph: "ex : boulangerie artisanale" },
          { n: "comptable", label: "Expert-comptable du client", type: "text" }
        ]
      },
      {
        title: "Pièces & besoins",
        hint: "Listez ce que vous possédez : l'assistant en déduit ce qui manque.",
        fields: [
          { n: "statut", label: "État du dossier", type: "select", options: ["Nouveau dossier à ouvrir", "Dossier existant à reprendre"], def: "Nouveau dossier à ouvrir" },
          { n: "pieces", label: "Pièces déjà en votre possession (une par ligne)", type: "textarea", rows: 4, ph: "KBIS / extrait RCS\nRIB professionnel\nContrat de gestion signé\nIdentité du dirigeant\nAttestation URSSAF" },
          { n: "besoins", label: "Besoins du client (une par ligne)", type: "textarea", rows: 4, req: true, ph: "Facturation mensuelle\nRelances des impayés\nDéclarations URSSAF / TVA\nPointage bancaire\nClassement du courrier" }
        ]
      }
    ],
    generate: function (v) {
      var up = (v.pieces || "").toUpperCase();
      function have(kw) { return up.indexOf(kw) !== -1; }
      var standard = [
        { doc: "KBIS / extrait RCS", kw: "KBIS" },
        { doc: "RIB professionnel", kw: "RIB" },
        { doc: "Identité du dirigeant (CNI / passeport)", kw: "IDENTITE" },
        { doc: "Contrat de gestion signé", kw: "CONTRAT" },
        { doc: "Mandat SEPA (prélèvement des honoraires)", kw: "SEPA" },
        { doc: "Accès outils du client (compta, banque, mail)", kw: "ACCES" },
        { doc: "Attestation URSSAF en cours", kw: "URSSAF" },
        { doc: "Assurance RC professionnelle", kw: "ASSURANCE" }
      ];
      var manque = standard.filter(function (a) { return !have(a.kw); });
      var pieces = (v.pieces || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var besoins = (v.besoins || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var y = new Date().getFullYear();
      var plan =
        "📁 Dossier – " + v.entreprise + "\n" +
        "   ├─ 00-CONTACT (fiche client, coordonnées, contrat de gestion)\n" +
        "   ├─ 01-IDENTITE (KBIS / RCS, statuts, RIB)\n" +
        "   ├─ 02-PRE-COMPTA (TVA, liasses, pointages bancaires)\n" +
        "   ├─ 03-SOCIAL (URSSAF, paie, attestations)\n" +
        "   ├─ 04-COMMERCIAL (devis, factures, relances)\n" +
        "   └─ 05-ECHANCES (déclarations, contrats, renouvellements " + y + ")";
      var courrier = "Objet : Ouverture de votre dossier de gestion\n\nBonjour,\n\nPour démarrer la gestion de votre dossier, merci de nous transmettre : " +
        (manque.length ? manque.map(function (a) { return a.doc; }).join(" ; ") : "les pièces listées dans votre dossier") +
        "\n\nVous pouvez nous les transmettre par e-mail, en ligne ou en les déposant.\n\nMerci de votre confiance.\n\nL'équipe GestAffaires – 06 12 34 56 78 · contact@gestaffaires.fr";
      return '<div class="ws-box"><h4>Dossier client – ' + esc(v.entreprise) + "</h4>" +
        "<h4>🔖 Fiche synthèse</h4><ul class='ws-list'>" +
        "<li><b>Forme</b> : " + esc(v.forme) + "</li>" +
        (v.siret ? "<li><b>SIRET</b> : " + esc(v.siret) + "</li>" : "") +
        (v.activite ? "<li><b>Activité</b> : " + esc(v.activite) + "</li>" : "") +
        (v.comptable ? "<li><b>Comptable</b> : " + esc(v.comptable) + "</li>" : "") +
        "<li><b>État</b> : " + esc(v.statut) + "</li></ul>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>✅ Pièces à réunir (' + manque.length + ")</h4><ul class='ws-list ws-check'>" +
        (manque.length ? manque.map(function (a) { return "<li>" + esc(a.doc) + "</li>"; }).join("") : "<li>Toutes les pièces de base sont réunies.</li>") +
        "</ul>" +
        "<h4>📦 Pièces déjà en main</h4><ul class='ws-list'>" +
        (pieces.length ? pieces.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") : "<li>Aucune.</li>") +
        "</ul></div>" +
        '<div class="ws-box"><h4>🗄️ Plan de classement (à créer)</h4><pre class="ws-pre">' + esc(plan) + "</pre>" +
        (besoins.length ? "<h4>🎯 Besoins pris en charge</h4><ul class='ws-list'>" + besoins.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "") +
        "</div></div>" +
        '<div class="ws-box" style="margin-top:12px;"><h4>✉️ Courrier prêt à envoyer au client</h4><pre class="ws-pre">' + esc(courrier) + "</pre></div></div>";
    }
  });

  /* ---------- 2. Facturation & relances ---------- */
  TOOLS.push({
    id: "factu",
    name: "Facturation & relances",
    desc: "Une facture impayée ? L'assistant génère la relance adaptée (courtoise, ferme ou mise en demeure) prête à envoyer.",
    icon: "🧾",
    payment: false,
    steps: [
      {
        title: "La facture impayée",
        hint: "Choisissez le client, le numéro et le montant de la facture à relancer.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Nom du client *", type: "text", req: true },
          { n: "num", label: "N° de facture *", type: "text", req: true, ph: "ex : FA-2026-0042" },
          { n: "montant", label: "Montant TTC (€) *", type: "number", min: "0", step: "0.01", req: true },
          { n: "emise", label: "Date d'émission", type: "date" },
          { n: "echeance", label: "Date d'échéance", type: "date" }
        ]
      },
      {
        title: "Historique & canal",
        hint: "L'assistant choisit le ton en fonction des relances déjà envoyées.",
        fields: [
          { n: "historique", label: "Relances déjà envoyées", type: "select", options: ["Aucune", "1 relance courtoise", "2 relances", "3 + (bloquée)"], def: "Aucune" },
          { n: "canal", label: "Canal d'envoi", type: "select", options: ["E-mail", "Courrier recommandé"], def: "E-mail" }
        ]
      }
    ],
    generate: function (v) {
      var mt = fmtMoney(Number(v.montant) || 0);
      var retard = "";
      if (v.echeance) {
        var d = new Date(v.echeance + "T00:00:00");
        var jours = Math.max(0, Math.round((new Date() - d) / 86400000));
        retard = jours > 0 ? "<b>" + jours + " j de retard</b>" : "échéance à venir";
      }
      var hist = v.historique || "Aucune";
      var objet, intro, corps, ton, sortie;
      if (hist === "Aucune") {
        objet = "Rappel – Facture " + v.num + " (" + mt + ")";
        intro = "Bonjour,\n\nNous nous permettons de vous rappeler la facture " + v.num + " d'un montant de " + mt + ".";
        corps = "Il semble que le règlement ne soit pas encore parvenu. Merci de nous confirmer son traitement ou son échéance prévue.";
        ton = "Politesse, aucune pénalité évoquée.";
      } else if (hist === "1 relance courtoise") {
        objet = "Relance – Facture " + v.num + " (" + mt + ")";
        intro = "Bonjour,\n\nMalgré notre précédent rappel, la facture " + v.num + " de " + mt + " reste impayée.";
        corps = "Merci de procéder au règlement sous 8 jours. À défaut, des pénalités de retard pourront s'appliquer (10 points au-dessus du taux directeur de la BCE).";
        ton = "Ton ferme, pénalités annoncées.";
      } else if (hist === "2 relances") {
        objet = "Mise en demeure – Facture " + v.num + " (" + mt + ")";
        intro = "Bonjour,\n\nLa facture " + v.num + " de " + mt + " reste impayée malgré nos deux relances précédentes.";
        corps = "Par la présente, il vous est demandé de régler sous 8 jours. À défaut : pénalités de retard, indemnité forfaitaire de recouvrement de 40 € et poursuites (injonction de payer).";
        ton = "Mise en demeure avec délai impératif.";
      } else {
        objet = "Dernière notification avant recouvrement – " + v.num;
        intro = "Bonjour,\n\nSans règlement sous 5 jours, la facture " + v.num + " de " + mt + " sera transmise à un service de recouvrement.";
        corps = "Une issue amiable reste préférable : contactez-nous pour convenir d'un échéancier.";
        ton = "Dernier avis avant précontentieux.";
      }
      sortie = hist === "Aucune" ? "Envoyez ce rappel." :
        (hist === "1 relance courtoise" ? "Envoyez la relance ferme." :
        (hist === "2 relances" ? "Envoyez la mise en demeure (idéalement en recommandé)." : "Envoyez le dernier avis, puis actionnez le recouvrement."));
      var corpsFinal = intro + "\n\n" + corps + (v.canalecheance ? "" : "") + "\n\nCordialement,\nL'équipe GestAffaires\n06 12 34 56 78 · contact@gestaffaires.fr";
      return '<div class="ws-box"><h4>Relance – ' + esc(v.entreprise) + "</h4>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>🧾 Récapitulatif</h4><ul class="ws-list">' +
        "<li><b>Facture</b> : " + esc(v.num) + "</li>" +
        "<li><b>Montant</b> : " + mt + "</li>" +
        (v.emise ? "<li><b>Émise le</b> : " + esc(v.emise) + "</li>" : "") +
        (v.echeance ? "<li><b>Échéance</b> : " + esc(v.echeance) + " · " + retard + "</li>" : "") +
        "<li><b>Canal</b> : " + esc(v.canal) + "</li>" +
        "<li><b>Étape</b> : " + esc(sortie) + "</li></ul></div>" +
        '<div class="ws-box"><h4>🔤 ' + esc(ton) + "</h4>" +
        '<p class="ws-label">Objet</p><p class="ws-quote">' + esc(objet) + "</p>" +
        '<p class="ws-label">Message prêt à copier</p><pre class="ws-pre">' + esc(corpsFinal) + "</pre></div></div>" +
        '<div class="ws-box" style="margin-top:12px;border-color:#8b6bff;background:#f7f5ff;"><h4>ℹ️ Précisions légales</h4><p class="ws-hint">Pénalités de retard et indemnité forfaitaire de 40 € ne sont applicables que si elles figurent dans vos CGV et que la mention est rappelée sur la facture. Règles à vérifier avec votre comptable ou sur le site des impôts.</p></div></div>';
    }
  });

  /* ---------- 3. Déclarations & échéances ---------- */
  TOOLS.push({
    id: "decla",
    name: "Déclarations & échéances",
    desc: "Le calendrier annuel des déclarations du client (URSSAF, TVA, CFE, résultat) et sa checklist mensuelle de préparation.",
    icon: "📆",
    payment: false,
    steps: [
      {
        title: "Le client & le régime",
        hint: "Le calendrier dépend du régime de l'entreprise.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Entreprise *", type: "text", req: true },
          { n: "forme", label: "Forme juridique", type: "select", options: ["Auto-entrepreneur", "EI", "EURL", "SARL", "SASU", "SAS", "Association"], def: "Auto-entrepreneur" },
          { n: "tva", label: "Régime TVA", type: "select", options: ["Franchise (micro / pas de TVA)", "Réel simplifié (TVA trimestrielle)", "Réel normal (TVA mensuelle)"], def: "Franchise (micro / pas de TVA)" },
          { n: "mode", label: "Paiement URSSAF", type: "select", options: ["Mensuel", "Trimestriel", "Non concerné"], def: "Mensuel" }
        ]
      },
      {
        title: "Échéances propres au client",
        hint: "Ajoutez les échéances connues (assurances, crédits, renouvellements).",
        fields: [
          { n: "comptable", label: "Expert-comptable du client", type: "text" },
          { n: "propres", label: "Autres échéances connues (une par ligne)", type: "textarea", rows: 4, ph: "Renouvellement assurance RC – janvier\nÉchéance crédit – chaque 15 du mois\nCertificat SSL – novembre" }
        ]
      }
    ],
    generate: function (v) {
      var mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
      var y = new Date().getFullYear();
      var mensuel = v.mode.indexOf("Mensuel") !== -1;
      var trimestriel = v.mode.indexOf("Trimestriel") !== -1;
      var tvTri = v.tva.indexOf("trimestrielle") !== -1;
      var tvMen = v.tva.indexOf("mensuelle") !== -1;
      var ligne = mois.map(function (m, i) {
        var evts = [];
        if (mensuel) evts.push("URSSAF – cotisation (début de mois)");
        if (trimestriel && [0, 2, 5, 8].indexOf(i) !== -1) evts.push("URSSAF – cotisation trimestrielle");
        if (tvTri && [2, 5, 8, 11].indexOf(i) !== -1) evts.push("TVA trimestrielle – avant le 15 du mois suivant");
        if (tvMen) evts.push("TVA mensuelle – avant le 15");
        if (i === 11) evts.push("CFE – taxation foncière (échéance décembre)");
        if (i === 0) evts.push("Renouvellements : assurances, abonnements, licences");
        return "<tr><td>" + m + "</td><td>" + (evts.length ? evts.join("<br>") : "<span class='ws-hint'>—</span>") + "</td></tr>";
      }).join("");
      var propres = (v.propres || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      return '<div class="ws-box"><h4>Échéancier ' + y + " – " + esc(v.entreprise) + "</h4>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>📅 Calendrier des déclarations</h4><table class="admin-table"><thead><tr><th>Mois</th><th>Échéances</th></tr></thead><tbody>' + ligne + "</tbody></table>" +
        (propres.length ? "<h4>➕ Échéances propres au client</h4><ul class='ws-list'>" + propres.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : "") +
        "</div>" +
        '<div class="ws-box"><h4>✅ Checklist mensuelle de préparation</h4><ul class="ws-list ws-check">' +
        "<li>Pointage bancaire des encaissements et décaissements</li>" +
        "<li>Classement (numérisation) des factures reçues et émises</li>" +
        "<li>Vérifier RIB et coordonnées auprès des organismes</li>" +
        "<li>Consulter le relevé URSSAF / TVA attendu</li>" +
        (v.comptable ? "<li>Transmettre les pièces à " + esc(v.comptable) + " avant le 5 du mois</li>" : "<li>Prévoir la transmission des pièces à l'expert-comptable</li>") +
        "</ul>" +
        '<h4>📄 Déclaration annuelle de résultat</h4><p class="ws-hint">Dépôt entre avril et mai ' + y + " selon la forme (" + esc(v.forme) + ") — échéance exacte à confirmer avec l'expert-comptable (calendrier des impôts).</p>" +
        "</div></div>" +
        "<p class='ws-hint' style='margin-top:10px;'>⚠️ Dates indicatives (métropole) : toujours confirmer avec l'expert-comptable ou sur impots.gouv.fr / urssaf.fr avant toute déclaration. Tout retard ouvre droit à pénalités.</p></div>";
    }
  });

  /* ---------- 4. Classement & archivage ---------- */
  TOOLS.push({
    id: "classement",
    name: "Classement & archivage",
    desc: "Plan de classement type du client, règle de nommage et durées légales de conservation, prêts à appliquer.",
    icon: "🗄️",
    payment: false,
    steps: [
      {
        title: "Le dossier",
        hint: "Le support de classement du client.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Entreprise *", type: "text", req: true },
          { n: "support", label: "Support", type: "select", options: ["Numérique", "Papier", "Mixte (papier + numérique)"], def: "Numérique" }
        ]
      },
      {
        title: "Types de documents",
        hint: "Les familles de documents à ranger.",
        fields: [
          { n: "types", label: "Familles de documents (une par ligne)", type: "textarea", rows: 4, req: true, ph: "Juridique & identité\nPré-compta & TVA\nSocial & URSSAF\nCommercial & facturation\nÉchéances & contrats" }
        ]
      }
    ],
    generate: function (v) {
      var familles = (v.types || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!familles.length) familles = ["Juridique & identité", "Pré-compta & TVA", "Social & URSSAF", "Commercial"];
      var plan = "📁 Dossier – " + v.entreprise + " (" + new Date().getFullYear() + ")\n";
      familles.forEach(function (f, i) {
        plan += "   ├─ " + String(i + 1).padStart(2, "0") + "-" + stripAcc(f).toUpperCase().trim().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/gi, "") + "/\n";
      });
      plan += "   └─ 99-ARCHIVES/";
      var durees = [
        ["Factures et pièces comptables", "10 ans"],
        ["Livres et journaux comptables", "10 ans"],
        ["Registre du personnel", "5 ans après le départ"],
        ["Bulletins de paie", "5 ans"],
        ["Contrats commerciaux", "5 ans après la fin du contrat"],
        ["Déclarations fiscales (TVA, IS)", "6 ans (jusqu'à 10 ans)"],
        ["Documents d'assurance (après sinistre)", "10 ans"],
        ["KBIS / RCS", "Durée de vie de la société"]
      ];
      return '<div class="ws-box"><h4>Classement – ' + esc(v.entreprise) + " (" + esc(v.support) + ")</h4>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>🗂️ Plan de classement (à copier)</h4><pre class="ws-pre">' + esc(plan) + "</pre>" +
        "<h4>🏷️ Règle de nommage recommandée</h4><pre class='ws-pre'>AAAA-MM-JJ_Type_Client_Description.ext\nEx : 2026-10-05_FAC_DUPONT-BOULANGERIE_octobre.pdf</pre></div>" +
        '<div class="ws-box"><h4>🗓️ Durées légales de conservation</h4><table class="admin-table"><thead><tr><th>Document</th><th>Durée</th></tr></thead><tbody>' +
        durees.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>" +
        '<div class="ws-box" style="margin-top:12px;"><h4>✅ Checklist de numérisation</h4><ul class="ws-list ws-check">' +
        "<li>Scanner en PDF (300 dpi, texte lisible)</li>" +
        "<li>Appliquer la règle de nommage</li>" +
        "<li>Ranger dans le plan de classement du client</li>" +
        "<li>Sauvegarde 3-2-1 (original + 2 copies, dont 1 hors site)</li>" +
        "<li>Année bouclée → déplacer dans « Archives »</li></ul></div></div>";
    }
  });

  /* ---------- 5. Trésorerie & pointage ---------- */
  TOOLS.push({
    id: "treso",
    name: "Trésorerie & pointage",
    desc: "Solde et opérations à venir : prévisionnel 30/60/90 jours du client et checklist de pointage bancaire.",
    icon: "💶",
    payment: false,
    steps: [
      {
        title: "Le dossier",
        hint: "Le compte bancaire du client à suivre.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Entreprise *", type: "text", req: true },
          { n: "banque", label: "Banque", type: "text", ph: "ex : Crédit Agricole / BNP / La Banque Postale" },
          { n: "solde", label: "Solde actuel du compte (€)", type: "number", min: "0", step: "0.01", def: "0" }
        ]
      },
      {
        title: "Opérations à venir",
        hint: "Une opération par ligne : date | libellé | entrée € | sortie €",
        fields: [
          { n: "ops", label: "Opérations à venir *", type: "textarea", rows: 6, req: true, ph: "2026-09-25 | Loyer local | 0 | 850\n2026-09-27 | Facture client A | 1200 | 0\n2026-10-05 | URSSAF | 0 | 310\n2026-11-08 | Crédit bail | 0 | 220" }
        ]
      }
    ],
    generate: function (v) {
      var entries = (v.ops || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
        var p = s.split("|").map(function (x) { return x.trim(); });
        return { d: p[0] || "", lib: p[1] || "", entre: Number(p[2]) || 0, sort: Number(p[3]) || 0 };
      });
      var soldei = Number(v.solde) || 0;
      var solde = soldei;
      var rows = entries.map(function (e) {
        solde += e.entre - e.sort;
        return "<tr><td>" + esc(e.d) + "</td><td>" + esc(e.lib) + "</td><td class='right'>" + fmtMoney(e.entre) + "</td><td class='right'>" + fmtMoney(e.sort) + "</td><td class='right'><b>" + fmtMoney(solde) + "</b></td></tr>";
      }).join("");
      var totalE = entries.reduce(function (s, e) { return s + e.entre; }, 0);
      var totalS = entries.reduce(function (s, e) { return s + e.sort; }, 0);
      var now = new Date();
      function soldeDans(jours) {
        var lim = new Date(now.getTime() + jours * 86400000);
        var s = soldei;
        entries.forEach(function (e) {
          if (e.d) {
            var dd = new Date(e.d + "T00:00:00");
            if (!isNaN(dd.getTime()) && dd <= lim) s += e.entre - e.sort;
          }
        });
        return s;
      }
      function kpi(titre, val) {
        return "<div class='ws-kpi'><b style='color:" + (val < 0 ? "#ff7a7a" : "#7ce8c8") + "'>" + fmtMoney(val) + "</b><span>" + titre + "</span></div>";
      }
      var j30 = soldeDans(30), j60 = soldeDans(60), j90 = soldeDans(90);
      return '<div class="ws-box"><h4>Trésorerie – ' + esc(v.entreprise) + (v.banque ? " (" + esc(v.banque) + ")" : "") + "</h4>" +
        '<div class="ws-kpis">' + kpi("Prévisionnel J+30", j30) + kpi("J+60", j60) + kpi("J+90", j90) + "</div>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>📋 Prévisionnel détaillé</h4><table class="admin-table"><thead><tr><th>Date</th><th>Libellé</th><th>Entrées</th><th>Sorties</th><th>Solde</th></tr></thead><tbody>' +
        rows +
        '<tr><td colspan="2"><b>Totaux</b></td><td class="right">' + fmtMoney(totalE) + "</td><td class='right'>" + fmtMoney(totalS) + "</td><td class='right'><b>" + fmtMoney(solde) + "</b></td></tr></tbody></table>" +
        (j90 < 0 ? '<div class="ws-box" style="margin-top:10px;border-color:#f0c36d;background:#fffbf0;"><p><b>⚠️ Solde négatif prévu à 90 jours :</b> anticiper (relance impayés, échelonnement fournisseur, autorisation de découvert).</p></div>' : "") +
        "</div>" +
        '<div class="ws-box"><h4>✅ Pointage bancaire hebdomadaire</h4><ul class="ws-list ws-check">' +
        "<li>Comparer le relevé avec les opérations attendues</li>" +
        "<li>Repérer les débits non reconnus → vérifier auprès de la banque</li>" +
        "<li>Suivre les impayés et rejets (URSSAF, fournisseurs)</li>" +
        "<li>Mettre à jour le solde réel dans cet outil</li></ul></div></div>" +
        '<p class="ws-hint" style="margin-top:8px;">Estimation à partir des opérations saisies : elle ne remplace pas le relevé officiel de la banque.</p></div>';
    }
  });

  /* ---------- 6. Reporting client ---------- */
  TOOLS.push({
    id: "report",
    name: "Reporting client",
    desc: "L'assistant lit les documents établis pour le client (factures, devis, contrats) et rédige le rapport prêt à envoyer.",
    icon: "📊",
    payment: false,
    steps: [
      {
        title: "Le rapport",
        hint: "Choisissez le client : ses documents établis seront repris automatiquement.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "periode", label: "Période du rapport", type: "text", ph: "ex : Septembre 2026" }
        ]
      },
      {
        title: "Actions & suites",
        hint: "Ce qui a été fait et ce qui reste à faire pour ce client.",
        fields: [
          { n: "actions", label: "Actions réalisées pour le client (une par ligne) *", type: "textarea", rows: 4, req: true, ph: "Émission de la facture mensuelle\nRelance du devis en attente\nPointage bancaire du mois\nClassement des pièces URSSAF" },
          { n: "dossiers", label: "Dossiers en cours (description | statut) – une par ligne", type: "textarea", rows: 3, ph: "Recouvrement facture FA-2026-0042 | en cours\nOuverture dossier TVA | à terminer" },
          { n: "prochaines", label: "Prochaines étapes (une par ligne)", type: "textarea", rows: 3, ph: "Relancer la facture FA-0043 sous 7 jours\nPréparer le dossier TVA du trimestre" }
        ]
      }
    ],
    generate: function (v) {
      var cl = v.clientId ? getClients().filter(function (c) { return c.id === v.clientId; })[0] : null;
      var factures = load(LS_FACTURES, []).filter(function (f) { return !v.clientId || f.clientId === v.clientId; });
      var devis = load(LS_DEVIS, []).filter(function (d) { return !v.clientId || d.clientId === v.clientId; });
      var contrats = load(LS_CONTRATS, []).filter(function (c) { return !v.clientId || c.clientId === v.clientId; });
      var caTotal = 0, payees = 0, attente = 0;
      factures.forEach(function (f) {
        var tot = (f.lignes || []).reduce(function (s, l) {
          var q = Number(l.qte) || 0, p = Number(l.pu) || 0, tv = Number(l.tva) || 0;
          return s + q * p * (1 + tv / 100);
        }, 0);
        if (f.statut !== "annulee") caTotal += tot;
        if (f.statut === "payee") payees++; else if (f.statut === "en_attente") attente++;
      });
      var devisAtt = devis.filter(function (d) { return d.statut === "en_attente"; }).length;
      var actions = (v.actions || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var dossiers = (v.dossiers || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
        var p = s.split("|");
        return { d: (p[0] || "").trim(), st: ((p[1] || "en cours")).trim() };
      });
      var prochaines = (v.prochaines || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var nom = cl ? (cl.name || cl.company || v.entreprise) : (v.entreprise || "Client");
      var bloc =
        "Objet : Point d'activité " + (v.periode || "") + " – " + nom +
        "\n\nBonjour,\n\nVoici le point d'activité pour " + (v.periode || "la période") + " :\n" +
        (actions.length ? "• " + actions.join("\n• ") : "• Aucune action saisie") +
        (prochaines.length ? "\n\nProchaines étapes :\n• " + prochaines.join("\n• ") : "") +
        "\n\nPour toute question, je reste à votre disposition.\n\nL'équipe GestAffaires\n06 12 34 56 78 · contact@gestaffaires.fr";
      return '<div class="ws-box"><h4>Rapport ' + (v.periode ? esc(v.periode) : "") + " – " + esc(nom) + "</h4>" +
        '<div class="ws-kpis">' +
        "<div class='ws-kpi'><b>" + factures.length + "</b><span>Factures établies</span></div>" +
        "<div class='ws-kpi'><b>" + devis.length + "</b><span>Devis rédigés</span></div>" +
        "<div class='ws-kpi'><b>" + contrats.length + "</b><span>Contrats suivis</span></div></div>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>✅ Actions réalisées</h4><ul class="ws-list">' +
        (actions.length ? actions.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") : "<li>Aucune action saisie.</li>") +
        "</ul>" +
        (dossiers.length ? "<h4>📁 Dossiers en cours</h4><table class='admin-table'><thead><tr><th>Dossier</th><th>Statut</th></tr></thead><tbody>" +
          dossiers.map(function (d) { return "<tr><td>" + esc(d.d) + "</td><td>" + esc(d.st) + "</td></tr>"; }).join("") + "</tbody></table>" : "") +
        "</div>" +
        '<div class="ws-box"><h4>📄 Documents produits pour le client</h4><ul class="ws-list">' +
        "<li>" + factures.length + " facture(s), " + payees + " payée(s), " + attente + " en attente (" + fmtMoney(caTotal) + " TTC).</li>" +
        "<li>" + devis.length + " devis rédigés dont " + devisAtt + " en attente — relance conseillée sous 7 jours.</li>" +
        "<li>" + contrats.length + " contrat(s) en suivi.</li></ul>" +
        "<h4>🚀 Prochaines étapes</h4><ul class='ws-list ws-check'>" +
        (prochaines.length ? prochaines.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") : "<li>Précisez-les pour compléter le rapport.</li>") +
        "</ul></div></div>" +
        '<div class="ws-box" style="margin-top:12px;"><h4>✉️ Bloc prêt à envoyer au client</h4><pre class="ws-pre">' + esc(bloc) + "</pre></div></div>";
    }
  });

  /* ---------- 7. Google Business Profile (fiche du client) ---------- */
  TOOLS.push({
    id: "gbp",
    name: "Google Business – fiche client",
    desc: "La fiche Google de l'entreprise du client : description, services, photos et checklist de mise en ligne.",
    icon: "📍",
    payment: false,
    steps: [
      {
        title: "L'entreprise du client",
        hint: "Les informations affichées sur Google.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Nom de l'entreprise *", type: "text", req: true },
          { n: "categorie", label: "Catégorie principale *", type: "text", req: true, ph: "ex : Boulangerie artisanale" },
          { n: "ville", label: "Ville *", type: "text", req: true },
          { n: "adresse", label: "Adresse (ou zone d'intervention)", type: "text" },
          { n: "telephone", label: "Téléphone *", type: "tel", req: true }
        ]
      },
      {
        title: "Contact et contenu",
        hint: "Ce que les clients verront sur la fiche.",
        fields: [
          { n: "site", label: "Site web", type: "text", ph: "https://…" },
          { n: "horaires", label: "Horaires", type: "text", def: "Lun–Ven 9h–18h" },
          { n: "services", label: "Services du client (un par ligne)", type: "textarea", rows: 3, req: true, ph: "Pain au levain\nViennoiseries\nTraiteur d'événements" },
          { n: "photo", label: "Photo principale de la fiche", type: "media" }
        ]
      }
    ],
    generate: function (v) {
      var services = (v.services || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var med = mediaById(v.photo);
      var desc = v.entreprise + " – " + v.categorie + " " + (v.ville ? "à " + v.ville : "").trim() + ". " +
        (services.length ? "Services : " + services.join(", ") + ". " : "") +
        (v.telephone ? "Contact : " + v.telephone + ". " : "") +
        (v.site ? "Site : " + v.site + ". " : "") +
        (v.adresse ? "Adresse : " + v.adresse + ". " : "") +
        "Accueil chaleureux et devis / réponse rapide. Pensez à nous : avis clients bienvenus !";
      var svcList = services.length ? services.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") : "<li>Aucun service.</li>";
      var posts = [
        { t: "Présentation", c: "👋 Découvrez " + v.entreprise + " : " + (services[0] || v.categorie) + (v.ville ? " à " + v.ville : "") + ". Réponse rapide et accueil professionnel. 👉 " + (v.site || "Réservez par téléphone") + " #" + stripAcc(v.ville).replace(/[^a-zA-Z0-9]/g, "") },
        { t: "Réalisation", c: "✅ " + (services[1] || services[0] || "Nouveauté") + " disponible chez " + v.entreprise + " ! Passez nous voir ou appelez le " + v.telephone + " 👇" },
        { t: "Avis clients", c: "⭐ Vous avez apprécié " + v.entreprise + " ? Partagez votre avis sur Google — 30 secondes suffisent et cela aide énormément ! Merci 🙏" }
      ];
      return '<div class="ws-box"><h4>Fiche Google prête – ' + esc(v.entreprise) + "</h4>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>✍️ Description (à coller sur la fiche)</h4><p class="ws-quote">' + esc(desc) + "</p>" +
        "<h4>Services à lister</h4><ul class='ws-list'>" + svcList + "</ul></div>" +
        '<div class="ws-box"><h4>📸 Photos à déposer</h4>' +
        (med ? '<img src="' + med.dataUrl + '" alt="" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0;">' : "<p>Ajoutez une photo principale pour une fiche plus attractive.</p>") +
        "<h4>✅ Checklist de mise en ligne</h4><ul class='ws-list ws-check'>" +
        "<li>business.google.com → créer ou revendiquer la fiche</li><li>Catégorie : " + esc(v.categorie) + "</li>" +
        (v.ville ? "<li>Zone : " + esc(v.ville) + "</li>" : "") +
        (v.telephone ? "<li>Téléphone : " + esc(v.telephone) + "</li>" : "") +
        (v.site ? "<li>Site : " + esc(v.site) + "</li>" : "") +
        "<li>Horaires : " + esc(v.horaires) + "</li><li>Demander la vérification (carte postale / vidéo)</li></ul></div></div>" +
        '<div class="ws-box" style="margin-top:12px;"><h4>📅 3 publications prêtes à déposer</h4><ul class="ws-list">' +
        posts.map(function (p) { return "<li><b>" + p.t + "</b> : " + esc(p.c) + "</li>"; }).join("") + "</ul></div></div>";
    }
  });

  /* ---------- 8. Réseaux sociaux (compte client) ---------- */
  TOOLS.push({
    id: "social",
    name: "Réseaux sociaux – client",
    desc: "Pack de 7 jours de publications pour le compte de l'entreprise du client : textes, hashtags, visuels et heures.",
    icon: "📱",
    payment: false,
    steps: [
      {
        title: "Le compte",
        hint: "Ce que les visiteurs verront.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Nom de l'entreprise / page *", type: "text", req: true },
          { n: "handle", label: "Nom d'utilisateur (@…)", type: "text", ph: "ex : @boulangerie.dupont" },
          { n: "plateformes", label: "Plateforme principale", type: "select", options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "Toutes"], def: "Instagram" },
          { n: "ville", label: "Ville", type: "text", ph: "ex : Lyon" },
          { n: "public", label: "Public cible", type: "text", ph: "ex : riverains et clients de quartier" }
        ]
      },
      {
        title: "Identité visuelle",
        hint: "Photos et logo : tout ce qui servira dans les visuels.",
        fields: [
          { n: "theme", label: "Thème / style visuel", type: "text", ph: "ex : chaleureux, authentique" },
          { n: "tons", label: "Ton de communication", type: "select", options: ["Professionnel", "Décontracté", "Pédagogue", "Engagé", "Ludique"], def: "Professionnel" },
          { n: "photo", label: "Photo à utiliser dans les visuels", type: "media" }
        ]
      },
      {
        title: "Contenu (3 sujets)",
        hint: "Les thèmes que la page du client doit mettre en avant.",
        fields: [
          { n: "sujets", label: "3 sujets (un par ligne) *", type: "textarea", rows: 3, req: true, ph: "Nos produits / réalisations\nL'équipe et les coulisses\nOffres et nouveautés" }
        ]
      }
    ],
    generate: function (v) {
      var sujets = (v.sujets || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!sujets.length) sujets = ["Votre activité"];
      var med = mediaById(v.photo);
      var tag = stripAcc(v.handle || v.entreprise).replace(/\s+/g, "").replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "");
      var villeTag = v.ville ? " #" + stripAcc(v.ville).replace(/[^a-zA-Z0-9]/g, "") : "";
      var flows = {
        Professionnel: ["Conseil", "Réalisation", "Témoignage", "Conseil", "Réalisation", "Astuce", "Engagement"],
        Décontracté: ["Conseil", "Coulisses", "Astuce", "Conseil", "Coulisses", "Promotion", "Engagement"],
        Pédagogue: ["Tutoriel", "Conseil", "Conseil", "Tutoriel", "Réalisation", "Astuce", "Engagement"],
        Engagé: ["Réalisation", "Conseil", "Engagement", "Coulisses", "Conseil", "Témoignage", "Promotion"],
        Ludique: ["Astuce", "Coulisses", "Conseil", "Astuce", "Quiz", "Promotion", "Engagement"]
      };
      var types = flows[v.tons] || flows.Professionnel;
      var jours = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
      var hour = Math.floor(11 + Math.random() * 7);
      var captions = {
        Conseil: "💡 Conseil : ",
        Réalisation: "✅ Réalisation : ",
        Témoignage: "🗣️ Témoignage : ",
        Astuce: "⚙️ Astuce : ",
        Engagé: "🚀 ",
        Promotion: "🎉 Offre : ",
        Coulisses: "🎬 Dans les coulisses : ",
        Tutoriel: "📚 Tutoriel : ",
        Quiz: "🔍 À vous de jouer : "
      };
      function basic(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
      var week1 = jours.map(function (j, i) {
        var type = types[i % types.length];
        var sujet = sujets[i % sujets.length];
        var cap = captions[type] || "";
        var txt = cap + basic(sujet) + ". " + (v.entreprise ? v.entreprise : "") + " vous reçoit avec plaisir. 📞 Contact : " + (v.telephone ? v.telephone : "nous écrire") + " !" +
          (v.handle ? "\n\n👉 Suivez-nous : @" + tag : "") + "\n\n#" + tag + villeTag + " #Gestion #Digital";
        return { jour: j, type: type, sujet: sujet, text: txt, h: hour + (i % 3) };
      });
      var html = '<div class="ws-box"><h4>Pack 7 jours – ' + esc(v.entreprise) + "</h4>" +
        "<h4>Bio prête</h4><p class='ws-quote'>" +
        esc(v.entreprise + (v.theme ? " · " + v.theme : "") + (v.public ? " · Pour " + v.public : "") + " · " + v.tons + (v.handle ? "\n@" + tag : "")) + "</p>" +
        (med ? '<img src="' + med.dataUrl + '" alt="" style="max-width:280px;border-radius:10px;border:1px solid #e2e8f0;margin:6px 0;">' : "<p>Ajoutez une photo pour illustrer vos visuels.</p>") +
        '<h4 style="margin-top:12px;">📅 Publications prêtes à déposer (semaine 1)</h4>';
      week1.forEach(function (p, i) {
        html += '<div class="ws-post">' +
          "<div><b>" + p.jour + "</b> · " + esc(p.type) + " · “" + esc(basic(p.sujet)) + "” · à " + p.h + "h</div>" +
          "<pre class='ws-pre'>" + esc(p.text) + "</pre></div>";
      });
      return html + '</div><div class="ws-box" style="margin-top:12px;border-color:#e0a800;background:#fffaf0;"><h4>📲 Comment déposer ?</h4>' +
        "<p>Chaque publication est prête : connectez-vous au compte " + esc(v.plateformes) + " <b>de votre client</b> (avec son accord) et copiez-collez textes et photos aux heures indiquées. L'automatisation directe via l'API Meta est prévue dans une version serveur.</p></div>";
    }
  });

  /* ---------- 9. Contenus & visuels (client) ---------- */
  TOOLS.push({
    id: "content",
    name: "Contenus & visuels – client",
    desc: "Un visuel monté automatiquement avec les vraies photos du client : publication, story, bannière ou plaquette, téléchargeable.",
    icon: "🎨",
    payment: false,
    steps: [
      {
        title: "Le visuel",
        hint: "Ce que vous voulez produire.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Nom de l'entreprise / produit *", type: "text", req: true },
          { n: "type", label: "Type de visuel", type: "select", options: ["Publication Instagram", "Story", "Bannière web", "Plaquette A5", "Annonce"], def: "Publication Instagram" },
          { n: "titre", label: "Titre / accroche *", type: "text", req: true, ph: "ex : Votre boulangerie de quartier" },
          { n: "message", label: "Sous-titre / message", type: "text", ph: "ex : Pain au levain, viennoiseries et traiteur" }
        ]
      },
      {
        title: "La photo & l'appel à l'action",
        hint: "L'assistant monte la photo du client avec le design et le texte.",
        fields: [
          { n: "cta", label: "Bouton d'appel à l'action", type: "text", def: "Nous contacter" },
          { n: "couleur", label: "Couleur d'accent", type: "color", def: "#0CB5A6" },
          { n: "photo", label: "Photo à monter", type: "media", req: true, hint: "Choisissez une photo de la bibliothèque (ou téléversez-en une)." }
        ]
      }
    ],
    generate: function (v) {
      var med = mediaById(v.photo);
      if (!med) return "<div class='ws-box'><p class='empty-note'>Ajoutez d'abord une photo dans la bibliothèque média.</p></div>";
      var sizes = {
        "Publication Instagram": [1080, 1080], "Story": [1080, 1920], "Bannière web": [1920, 400],
        "Plaquette A5": [1080, 720], "Annonce": [1200, 628]
      }[v.type] || [1080, 1080];
      var w = sizes[0], h = sizes[1];
      var color = /^#[0-9a-f]{6}$/i.test(v.couleur) ? v.couleur : "#0CB5A6";
      var title = esc(v.titre).slice(0, 42);
      var sub = esc(v.message || v.entreprise).slice(0, 60);
      var cta = esc(v.cta || "Nous contacter");
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' +
        '<defs>' +
        '<linearGradient id="ov" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#06121f" stop-opacity="0.35"/>' +
        '<stop offset="100%" stop-color="#0B1B33" stop-opacity="0.92"/></linearGradient>' +
        '<clipPath id="cp"><rect width="' + w + '" height="' + h + '"/></clipPath>' +
        "</defs>" +
        '<image href="' + med.dataUrl + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#cp)"/>' +
        '<rect width="' + w + '" height="' + h + '" fill="url(#ov)"/>' +
        '<rect width="' + w + '" height="14" fill="' + color + '"/>' +
        '<text x="' + (w / 2) + '" y="' + (h * 0.52) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 16) + '" font-weight="800" fill="#ffffff" text-anchor="middle">' + title + "</text>" +
        '<text x="' + (w / 2) + '" y="' + (h * 0.62) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 34) + '" fill="#d6e4ef" text-anchor="middle">' + sub + "</text>" +
        '<rect x="' + (w / 2 - w * 0.17) + '" y="' + (h * 0.7) + '" width="' + (w * 0.34) + '" height="' + Math.round(h * 0.08) + '" rx="' + Math.round(h * 0.04) + '" fill="' + color + '"/>' +
        '<text x="' + (w / 2) + '" y="' + (h * 0.7 + h * 0.05) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 44) + '" font-weight="700" fill="#ffffff" text-anchor="middle">' + cta + "</text>" +
        '<text x="' + (w / 2) + '" y="' + (h * 0.93) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 52) + '" fill="#7CE8C8" text-anchor="middle">' + esc(v.entreprise) + " · géré par GestAffaires" + "</text>" +
        "</svg>";
      var dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      return '<div class="ws-box"><h4>🎨 Visuel monté automatiquement</h4>' +
        '<div class="ws-visual"><img src="' + dataUri + '" alt="Montage" style="width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;"></div>' +
        '<div class="ws-actions"><a class="admin-btn" href="' + dataUri + '" download="' + stripAcc(esc(v.entreprise)).replace(/\s+/g, "-").toLowerCase() + '.svg">⬇️ Télécharger le visuel (SVG)</a></div>' +
        '<p class="ws-hint">La photo est déjà intégrée : le montage est prêt à publier. Dimensions : ' + w + "×" + h + ". Pour un PNG, enregistrez l'image via le clic droit dans le navigateur.</p>" +
        videoNote() + "</div>";
    }
  });

  /* ---------- 10. Newsletter & annonce (client) ---------- */
  TOOLS.push({
    id: "news",
    name: "Newsletter & annonce",
    desc: "Newsletter, communiqué de presse ou annonce de promotion pour le client : objet, corps et CTA prêts à copier.",
    icon: "✉️",
    payment: false,
    steps: [
      {
        title: "Le client & le message",
        hint: "Le support à préparer.",
        fields: [
          { n: "client", type: "client", label: "Client concerné" },
          { n: "entreprise", label: "Entreprise *", type: "text", req: true },
          { n: "type", label: "Type de communication", type: "select", options: ["Newsletter", "Communiqué de presse", "Promotion / offre"], def: "Newsletter" },
          { n: "objet", label: "Objet / titre *", type: "text", req: true, ph: "ex : Rentrée : nos nouveautés" },
          { n: "cta", label: "Bouton d'appel à l'action", type: "text", def: "En savoir plus" },
          { n: "message", label: "Message * (une ligne = un paragraphe)", type: "textarea", rows: 5, req: true, ph: "Chers clients,\nNous sommes heureux de vous annoncer...\n- Point fort n°1\n- Point fort n°2\nNous restons à votre disposition." }
        ]
      },
      {
        title: "Finalisation",
        hint: "Date de validité et visuel éventuel.",
        fields: [
          { n: "dateval", label: "Date de fin / événement", type: "date" },
          { n: "photo", label: "Visuel d'illustration (facultatif)", type: "media" }
        ]
      }
    ],
    generate: function (v) {
      var med = mediaById(v.photo);
      var paragraphs = (v.message || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var bullet = paragraphs.filter(function (p) { return p.indexOf("- ") === 0; });
      var corps = paragraphs.filter(function (p) { return p.indexOf("- ") !== 0; }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
      var bullets = bullet.length ? "<ul class='ws-list'>" + bullet.map(function (b) { return "<li>" + esc(b.slice(2)) + "</li>"; }).join("") + "</ul>" : "";
      var type = v.type || "Newsletter";
      var objet = type === "Communiqué de presse" ? "Communiqué – " + v.entreprise + " : " + v.objet : v.objet;
      var preheader = type === "Communiqué de presse"
        ? "Pour diffusion immédiate"
        : (type === "Promotion / offre" ? "Offre exceptionnelle – durée limitée" : "Votre actualité " + v.entreprise);
      function fmt(d) {
        if (!d) return "";
        try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR"); } catch (e) { return d; }
      }
      var html =
        '<div class="ws-box"><h4>' + esc(type) + " – " + esc(v.entreprise) + "</h4>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>✍️ Structure prête à copier</h4>' +
        '<p class="ws-label">Préheader</p><p class="ws-quote">' + esc(preheader) + "</p>" +
        "<p class='ws-label'>Objet</p><p class='ws-quote'>" + esc(objet) + "</p>" +
        "<h4>Corps</h4>" + corps + bullets +
        (v.dateval ? "<p class='ws-hint'>Valable jusqu'au " + esc(fmt(v.dateval)) + ".</p>" : "") +
        '<div class="ws-box" style="margin-top:10px;background:#0b1b33;color:#fff;text-align:center;padding:10px;border-radius:8px;">' + esc(v.cta || "En savoir plus") + "</div>" +
        '<p style="font-size:12px;color:#5b6b7b;margin-top:8px;">' + esc(v.entreprise) + "</p></div>" +
        "<div class='ws-box'><h4>📤 Astuces d'envoi</h4><ul class='ws-list ws-check'>" +
        "<li>Emailing : utiliser un outil (Mailchimp, Brevo…) ou votre messagerie</li>" +
        "<li>Inclure votre logo + le numéro du client</li>" +
        "<li>Lien de désinscription obligatoire pour les newsletters</li>" +
        "<li>Communiqués : joindre une photo HD + coordonnées presse</li></ul>" +
        "<h4>🖼️ Visuel</h4>" +
        (med ? '<img src="' + med.dataUrl + '" alt="" style="max-width:100%;border-radius:10px;">' : "<p class='ws-hint'>Ajoutez une photo pour illustrer le message.</p>") +
        "</div></div></div>";
      return html;
    }
  });

  /* ==================================================================
     MOTEUR D'ASSISTANT (étapes)
     ================================================================== */
  function visibleFields(tool) {
    var st = tool.steps[state.step];
    if (!st) return [];
    return (st.fields || []).filter(function (f) {
      if (!f.when) return true;
      return !!f.when(state.inputs);
    });
  }
  function isLastStep(tool) { return state.step >= tool.steps.length - 1; }
  function toolTitle(tool) {
    var u = state.inputs.entreprise || state.inputs.societe || "";
    return u ? tool.name + " · " + u : tool.name;
  }

  function fieldHTML(f) {
    var v = state.inputs[f.n] != null ? state.inputs[f.n] : (f.def !== undefined ? f.def : "");
    var n = f.n, lab = f.label;
    var req = f.req ? " required" : "";
    var hint = f.hint ? '<p class="ws-hint">' + esc(f.hint) + "</p>" : "";
    if (f.type === "client") {
      var clients = getClients();
      var opts = ['<option value="">Choisir un client…</option>'];
      var cur = state.inputs.manualClient ? "__other__" : (state.inputs.clientId || "");
      clients.forEach(function (c) {
        var lib = c.company || c.name || "Client";
        if (c.name && c.company) lib = c.company + " · " + c.name;
        opts.push('<option value="' + esc(c.id) + '"' + (String(cur) === c.id ? " selected" : "") + ">" + esc(lib) + "</option>");
      });
      opts.push('<option value="__other__"' + (cur === "__other__" ? " selected" : "") + ">Autre entreprise (à saisir ci-dessous)</option>");
      return '<div class="form-field full"><label>' + esc(lab) + "</label>" +
        '<select name="' + n + '" data-ws-client>' + opts.join("") + "</select>" +
        '<p class="ws-hint">Choisir un client remplit les champs ci-dessous ; sinon sélectionnez « Autre entreprise » et saisissez directement.</p></div>';
    }
    if (f.type === "media") {
      var medias = getMedia();
      var thumbs = medias.map(function (m) {
        return '<label class="ws-media"><input type="radio" name="' + n + '" value="' + m.id + '"' + (String(v) === m.id ? " checked" : "") + ">" +
          '<img src="' + m.dataUrl + '" alt=""><span>' + esc(m.name) + "</span></label>";
      }).join("");
      return '<div class="form-field"><label>' + esc(lab) + "</label>" +
        '<div class="ws-media-grid">' + (thumbs || '<p class="ws-hint">Aucune photo. Téléversez-en une ci-dessous.</p>') + "</div>" +
        '<div class="ws-media-upload"><input type="file" accept="image/*" data-upload="' + n + '"><span class="ws-hint">Téléverser une photo → elle rejoint la bibliothèque et se sélectionne.</span></div>' +
        hint + "</div>";
    }
    if (f.type === "select") {
      var opts2 = (f.options || []).map(function (o) {
        return '<option value="' + esc(o) + '"' + (String(v) === o ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("");
      return '<div class="form-field"><label>' + esc(lab) + "</label><select name=\"" + n + "\"" + req + ">" + opts2 + "</select>" + hint + "</div>";
    }
    if (f.type === "textarea") {
      return '<div class="form-field"><label>' + esc(lab) + "</label><textarea name=\"" + n + "\" rows=\"" + (f.rows || 3) + "\"" + req + ">" + esc(v) + "</textarea>" + hint + "</div>";
    }
    return '<div class="form-field"><label>' + esc(lab) + "</label><input name=\"" + n + "\" type=\"" + (f.type || "text") + "\" value=\"" + esc(v) + "\"" +
      (f.ph ? ' placeholder="' + esc(f.ph) + '"' : "") + (f.min ? ' min="' + f.min + '"' : "") + (f.step ? ' step="' + f.step + '"' : "") + req + ">" + hint + "</div>";
  }

  function bindUploads(scope) {
    $$("[data-upload]", scope).forEach(function (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        addMedia(file, function (item) {
          if (item) {
            state.inputs[input.getAttribute("data-upload")] = item.id;
            renderAll();
          } else {
            alert("Photo non acceptée (taille ou format).");
          }
        });
      });
    });
  }
  function bindClientPicker(scope) {
    $$("[data-ws-client]", scope).forEach(function (sel) {
      sel.addEventListener("change", function () {
        var val = sel.value;
        if (val === "__other__") {
          state.inputs.manualClient = true; state.inputs.clientId = null;
        } else if (val) {
          var c = getClients().filter(function (x) { return x.id === val; })[0];
          if (!c) { sel.value = ""; return; }
          state.inputs.clientId = c.id; state.inputs.manualClient = false;
          state.inputs.entreprise = c.name || c.company || "";
        }
        renderAll();
      });
    });
  }
  function bindMediaSelect() {
    $$("input[type=radio][name]", adminMain()).forEach(function (r) {
      r.addEventListener("change", function () {
        state.inputs[r.name] = r.value;
      });
    });
  }
  function collectStep(scope, fields) {
    fields.forEach(function (f) {
      if (f.type === "client") return;
      var el = scope.querySelector('[name="' + f.n + '"]');
      if (el) state.inputs[f.n] = el.value.trim();
    });
  }

  function renderTool(tool) {
    var fields = visibleFields(tool);
    var stepsCount = tool.steps.length;
    var progress = Math.round(((state.step + 1) / stepsCount) * 100);
    var reqMissing = fields.filter(function (f) { return f.req && !((state.inputs[f.n] || "") + "").trim(); });

    var body =
      pageHead(tool.name, tool.desc) +
      '<div class="ws-wiz">' +
      '<div class="ws-progress"><div class="ws-progress-fill" style="width:' + progress + '%"></div></div>' +
      '<div class="ws-step-label">Étape ' + (state.step + 1) + " / " + stepsCount + " · " + esc(tool.steps[state.step].title) + "</div>" +
      (tool.steps[state.step].hint ? '<p class="ws-hint">' + esc(tool.steps[state.step].hint) + "</p>" : "") +
      '<form id="ws-form" data-ws-tool="' + tool.id + '">' +
      '<div class="admin-form-grid">' + fields.map(fieldHTML).join("") + "</div>" +
      '<div class="admin-form-actions">' +
      (state.step > 0 ? '<button type="button" class="admin-btn admin-btn-ghost" data-ws-prev>← Précédent</button>' : "") +
      '<button type="submit" class="admin-btn">' + (isLastStep(tool) ? "⚡ Générer automatiquement" : "Continuer →") + "</button>" +
      "</div></form></div>" +
      '<div id="ws-result"></div>' +
      historyCard(tool);

    adminMain().innerHTML = body;

    var form = $("#ws-form", adminMain());
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        collectStep(form, fields);
        reqMissing = fields.filter(function (f) { return f.req && !((state.inputs[f.n] || "") + "").trim(); });
        if (reqMissing.length) {
          var out = $("#ws-result", adminMain());
          if (out) {
            out.innerHTML = '<div class="ws-box" style="border-color:#f0c36d;background:#fffbf0;"><p><b>Il manque :</b> ' +
              reqMissing.map(function (f) { return esc(f.label); }).join(" · ") + "</p></div>";
          }
          return;
        }
        if (isLastStep(tool)) onGenerate(tool);
        else { state.step++; renderAll(); }
      });
    }
    var prev = $("[data-ws-prev]", adminMain());
    if (prev) prev.addEventListener("click", function () { if (state.step > 0) { state.step--; renderAll(); } });
    bindUploads(adminMain());
    bindClientPicker(adminMain());
    bindMediaSelect();
    bindHomeLink();
    bindHistory();
  }

  function onGenerate(tool) {
    var html = tool.generate(state.inputs);
    var entry = { date: today(), inputs: JSON.parse(JSON.stringify(state.inputs)), html: html, title: toolTitle(tool) };
    pushHistory(tool.id, entry);
    var out = $("#ws-result", adminMain());
    if (out) { out.innerHTML = html; out.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  function historyCard(tool) {
    var h = history(tool.id);
    if (!h.length) return "";
    var rows = h.map(function (entry, i) {
      return "<div class='ws-hist-item'><span>" + esc(entry.title || tool.name) + "</span><small>" + fmtDate(entry.date || today()) + "</small>" +
        '<span class="row-actions"><button class="mini-btn primary" data-ws-view="' + i + '">Voir</button>' +
        '<button class="mini-btn danger" data-ws-del="' + i + '">Supprimer</button></span></div>';
    }).join("");
    return card("<h3>🗃️ Résultats générés</h3>" + rows);
  }
  function bindHistory() {
    var h = history(state.tool);
    $$("[data-ws-view]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () {
        var e = h[Number(b.getAttribute("data-ws-view"))];
        if (!e) return;
        var out = $("#ws-result", adminMain());
        if (out) { out.innerHTML = e.html; window.scrollTo(0, 0); }
      });
    });
    $$("[data-ws-del]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () {
        if (confirm("Supprimer ce résultat ?")) {
          removeHistory(state.tool, Number(b.getAttribute("data-ws-del")));
          renderAll();
        }
      });
    });
  }
  function bindHomeLink() {
    $$("[data-ws-home]", adminMain()).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); activeHome(); });
    });
  }

  /* ---------- Historique persistant ---------- */
  function history(id) { return (getTools()[id] || []); }
  function pushHistory(id, entry) {
    var t = getTools();
    (t[id] = t[id] || []).unshift(entry);
    if (t[id].length > 20) t[id] = t[id].slice(0, 20);
    setTools(t);
  }
  function removeHistory(id, index) {
    var t = getTools();
    if (t[id]) t[id].splice(index, 1);
    setTools(t);
  }

  /* ==================================================================
     CADRE & ACCUEIL
     ================================================================== */
  function pageHead(title, sub) {
    return '<div class="admin-head"><div><h2>' + esc(title) + "</h2><p>" + esc(sub) + '</p></div>' +
      '<a class="admin-btn admin-btn-ghost" href="#" data-ws-home>← Missions client</a></div>';
  }
  function card(inner) { return '<div class="admin-card ws-card">' + inner + "</div>"; }
  function fmtDate(iso) {
    if (!iso) return "";
    try { return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR"); } catch (e) { return iso; }
  }

  function mediaCard() {
    var medias = getMedia();
    var cells = medias.map(function (m) {
      return '<div class="ws-media-cell"><img src="' + m.dataUrl + '" alt=""><span>' + esc(m.name) + '</span>' +
        '<button class="mini-btn danger" data-media-del="' + m.id + '" style="margin-top:6px;">Supprimer</button></div>';
    }).join("");
    return card(
      "<h3>📁 Bibliothèque média</h3>" +
      "<p class='ws-hint'>Les photos et logos (des clients ou de vos documents) sont stockés localement et réutilisés par les outils.</p>" +
      '<div class="ws-media-grid">' + (cells || '<p class="ws-hint">Aucune photo. Téléversez la première ci-dessous.</p>') + "</div>" +
      '<div class="ws-media-upload"><input type="file" accept="image/*" data-upload-home><span class="ws-hint">Choisir une photo à ajouter (JPG/PNG/WebP).</span></div>'
    );
  }

  function renderHome() {
    var cards = TOOLS.map(function (t) {
      var n = history(t.id).length;
      return '<button class="ws-tool" data-ws-open="' + t.id + '">' +
        '<span class="ws-tool-icon">' + t.icon + "</span>" +
        "<span class='ws-tool-name'>" + esc(t.name) + "</span>" +
        "<span class='ws-tool-desc'>" + esc(t.desc) + "</span>" +
        "<span class='ws-tool-count'>" + (n ? n + " résultat" + (n > 1 ? "s" : "") : "Nouveau") + "</span></button>";
    }).join("");

    adminMain().innerHTML =
      pageHead("Missions client", "Pour chacun de vos clients (gestion administrative & digitale) : choisissez le client, remplissez les étapes, l'assistant prépare le livrable final.") +
      '<div class="ws-grid">' + cards + "</div>" +
      mediaCard() +
      '<div class="ws-box" style="margin-top:16px;"><h4>ℹ️ Comment ça marche</h4><ul class="ws-list">' +
      "<li>Chaque mission est <b>rattachée à un client</b> : choisissez-le dans la liste (vos fiches de l'onglet Clients) ou saisissez son entreprise.</li>" +
      "<li>Chaque outil est un <b>assistant autonome</b> : il ne demande que ce qui manque, étape par étape.</li>" +
      "<li>Photos et logos : téléversez-les une fois, ils sont réutilisés (fiches Google, réseaux sociaux, montages).</li>" +
      "<li>Pour ce qui exige une API (poster, créer la fiche Google, envoyer un emailing), GestAffaires prépare <b>tout le pack final</b> : déposez-le sur le compte du client.</li>" +
      "<li>Rien n'est envoyé sur internet : tout reste dans votre navigateur.</li></ul></div>";

    $$("[data-ws-open]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () {
        state.tool = b.getAttribute("data-ws-open");
        state.step = 0;
        state.inputs = {};
        state.resultHtml = null;
        renderAll();
      });
    });
    var up = $("[data-upload-home]", adminMain());
    if (up) up.addEventListener("change", function () {
      var file = up.files && up.files[0];
      if (!file) return;
      addMedia(file, function (item) {
        if (!item) alert("Photo non acceptée (taille ou format).");
        renderHome();
      });
    });
    $$("[data-media-del]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () { removeMedia(b.getAttribute("data-media-del")); renderHome(); });
    });
    bindHomeLink();
  }

  function activeHome() {
    state.tool = null; state.step = 0; state.inputs = {}; state.resultHtml = null;
    renderHome();
  }

  function renderAll() {
    if (!state.tool) { renderHome(); return; }
    var tool = TOOLS.filter(function (t) { return t.id === state.tool; })[0];
    if (!tool) { activeHome(); return; }
    renderTool(tool);
  }

  return { render: renderAll };
})();