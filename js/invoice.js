/* ============================================================
   GestAffaires – « Espace de travail + » : FACTURATION AVANCÉE
   1. ÉDITEUR DE FACTURE : mise en page imprimable (PDF) avec logo
      OU nom de l'émetteur, coordonnées, mentions, IBAN, TVA par
      ligne. S'appuie sur ga_factures (mêmes données que le module
      Facturation) : aucune duplication.
   2. NOTES DE FRAIS : dépenses engagées pour un client, rattachées
      à son dossier (ga_notes_frais).
   Clés : ga_branding, ga_factures, ga_notes_frais.
   ============================================================ */
(function (GW) {
  "use strict";
  if (!GW) return;

  var esc = GW.esc, fmtMoney = GW.fmtMoney, fmtDate = GW.fmtDate;
  var today = GW.today, uid = GW.uid;
  var get = GW.get, put = GW.put, load = GW.load;
  var findClient = GW.findClient, clientLabel = GW.clientLabel;
  var docTotals = GW.docTotals;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var main = function () { return document.getElementById("admin-main"); };
  var K = { B: "ga_branding", F: "ga_factures", NF: "ga_notes_frais" };
  var FA_STATUS = [{ v: "brouillon", l: "Brouillon" }, { v: "en_attente", l: "Émise / impayée" }, { v: "payee", l: "Payée" }, { v: "annulee", l: "Annulée" }];

  function cid() { return GW.currentClientId(); }
  function vatRates() { return [0, 5.5, 10, 20]; }
  function clean(s) { return (s && s !== "TODO") ? s : ""; }
  function clientsOptions() {
    return [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; }));
  }

  /* ------------------------------------------------------------------
     IDENTITÉ ÉMETTEUR (ga_branding) — logo ou nom seul
     ------------------------------------------------------------------ */
  function defaultBrand() {
    var s = window.GA_SITE || {};
    return {
      logo: "",
      name: clean(s.company) || "GestAffaires",
      slogan: "Gestion · Administration · Digital",
      address: clean(s.address),
      siret: clean(s.siret),
      tva: "",
      email: clean(s.email),
      phone: clean(s.phoneDisplay),
      iban: "",
      bic: "",
      accent: "#0CB5A6",
      mentions: "Paiement à réception de facture. En cas de retard de paiement, des pénalités de retard pourront être appliquées (taux légal en vigueur) ainsi qu'une indemnité forfaitaire de recouvrement de 40 €."
    };
  }
  function branding() {
    var b = load(K.B, null);
    if (!b) return defaultBrand();
    var d = defaultBrand();
    Object.keys(d).forEach(function (k) { if (b[k] == null) b[k] = d[k]; });
    return b;
  }
  function saveBrand(b) { GW.save(K.B, b); }
  GW.getBranding = branding;

  function resizeImage(file, maxW, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        try {
          var scale = Math.min(1, maxW / img.width);
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          cb(c.toDataURL("image/png"));
        } catch (err) { cb(e.target.result); }
      };
      img.onerror = function () { cb(e.target.result); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------------
     MISE EN PAGE IMPRIMABLE (aperçu + impression)
     ------------------------------------------------------------------ */
  function docTitle(kind) { return kind === "devis" ? "DEVIS" : "FACTURE"; }

  function docBody(doc, cl, b) {
    var t = docTotals(doc.lignes);
    var accent = b.accent || "#0CB5A6";
    var brandTop = b.logo
      ? "<img src='" + b.logo + "' alt='" + esc(b.name) + "' style='max-height:92px;max-width:280px;'>"
      : "<div style='font-size:26px;font-weight:800;color:#0B1B33;letter-spacing:.02em;'>" + esc(b.name) + "</div>" +
        (b.slogan ? "<div style='font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#5b6b7b;margin-top:4px;'>" + esc(b.slogan) + "</div>" : "");
    var sender = [(b.address || "").replace(/\n/g, "<br>"), b.phone, b.email].filter(Boolean).join("<br>");
    var legal = [b.siret ? "SIRET : " + esc(b.siret) : "", b.tva ? "TVA intracom. : " + esc(b.tva) : ""].filter(Boolean).join(" · ");
    var clientLines = [];
    if (cl) {
      if (cl.name) clientLines.push(esc(cl.name));
      if (cl.company && cl.company !== cl.name) clientLines.push(esc(cl.company));
      if (cl.address) clientLines.push(esc(cl.address));
      if (cl.email) clientLines.push(esc(cl.email));
      if (cl.phone) clientLines.push(esc(cl.phone));
    }
    var rows = (doc.lignes || []).map(function (l) {
      return "<tr><td style='text-align:left;padding:9px 10px;border-bottom:1px solid #ececec;'>" + esc(l.des || "—") + "</td>" +
        "<td style='text-align:right;padding:9px 10px;border-bottom:1px solid #ececec;'>" + (Number(l.qte) || 0) + "</td>" +
        "<td style='text-align:right;padding:9px 10px;border-bottom:1px solid #ececec;'>" + fmtMoney(l.pu) + "</td>" +
        "<td style='text-align:right;padding:9px 10px;border-bottom:1px solid #ececec;'>" + (Number(l.tva) || 0) + " %</td>" +
        "<td style='text-align:right;padding:9px 10px;border-bottom:1px solid #ececec;'>" + fmtMoney((Number(l.qte) || 0) * (Number(l.pu) || 0)) + "</td></tr>";
    }).join("");
    var pay = (b.iban || b.bic) ? "<div style='border:1px solid #e2e2e2;border-radius:8px;padding:10px 12px;font-size:12px;margin-top:14px;'>" +
      "<b>Règlement</b><br>Merci d'indiquer le numéro <b>" + esc(doc.num || "") + "</b> lors de votre virement." +
      (b.iban ? "<br>IBAN : " + esc(b.iban) : "") + (b.bic ? " · BIC : " + esc(b.bic) : "") + "</div>" : "";
    return "<div class='ps-doc'>" +
      "<table style='width:100%;border-collapse:collapse;'><tr>" +
      "<td style='vertical-align:top;'>" + brandTop + "</td>" +
      "<td style='text-align:right;vertical-align:top;'>" +
      "<h1 style='margin:0;color:#0B1B33;font-size:30px;text-transform:uppercase;letter-spacing:.04em;'>" + docTitle(doc.kind) + "</h1>" +
      "<p style='margin:6px 0 0;color:#0B1B33;font-weight:700;font-size:15px;'>" + esc(doc.num || "—") + "</p>" +
      "<p style='margin:2px 0 0;color:#5b6b7b;font-size:12px;'>Date : " + fmtDate(doc.date) +
      (doc.echeance ? "<br>" + (doc.kind === "devis" ? "Valable jusqu'au" : "Échéance") + " : " + fmtDate(doc.echeance) : "") + "</p>" +
      "</td></tr></table>" +
      "<hr style='border:none;border-top:2px solid " + accent + ";margin:14px 0 18px;'>" +
      "<table style='width:100%;border-collapse:collapse;'><tr>" +
      "<td style='vertical-align:top;font-size:12px;color:#222;width:50%;'><b style='color:#0B1B33;'>Émetteur</b><br>" +
      esc(b.name) + (sender ? "<br>" + sender : "") + (legal ? "<br>" + legal : "") + "</td>" +
      "<td style='vertical-align:top;text-align:right;font-size:12px;color:#222;width:50%;'><b style='color:#0B1B33;'>" +
      (doc.kind === "devis" ? "Adressé à" : "Client") + "</b><br>" + (clientLines.join("<br>") || "—") + "</td></tr></table>" +
      (doc.note ? "<p style='font-size:12px;color:#333;margin:14px 0 4px;'><b>Objet :</b> " + esc(doc.note) + "</p>" : "") +
      "<table style='width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:12.5px;'>" +
      "<thead><tr style='background:" + accent + ";color:#fff;'>" +
      "<th style='text-align:left;padding:10px;'>Désignation</th><th style='text-align:right;padding:10px;'>Qté</th>" +
      "<th style='text-align:right;padding:10px;'>PU HT</th><th style='text-align:right;padding:10px;'>TVA</th>" +
      "<th style='text-align:right;padding:10px;'>Total</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table style='width:100%;border-collapse:collapse;'><tr><td></td><td style='width:300px;'>" +
      "<table style='width:100%;font-size:13px;border-collapse:collapse;'>" +
      "<tr><td style='padding:3px 0;'>Total HT</td><td style='text-align:right;'>" + fmtMoney(t.ht) + "</td></tr>" +
      "<tr><td style='padding:3px 0;'>Total TVA</td><td style='text-align:right;'>" + fmtMoney(t.tva) + "</td></tr>" +
      "<tr><td style='padding:8px 0 0;border-top:2px solid #0B1B33;font-weight:800;color:#0B1B33;'>Total TTC</td>" +
      "<td style='text-align:right;padding-top:8px;border-top:2px solid #0B1B33;font-weight:800;color:#0B1B33;font-size:16px;'>" + fmtMoney(t.ttc) + "</td></tr>" +
      "</table></td></tr></table>" + pay +
      "<div style='display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;'>" +
      "<div style='border-top:1px solid #999;padding-top:8px;font-size:12px;color:#444;'>Signature de l'émetteur</div>" +
      "<div style='border-top:1px solid #999;padding-top:8px;font-size:12px;color:#444;'>Signature du client</div></div>" +
      (b.mentions ? "<div style='margin-top:18px;font-size:9.5px;color:#6b7787;line-height:1.5;'>" + esc(b.mentions) + "</div>" : "") +
      "<div style='margin-top:14px;font-size:10px;color:#8b97a6;border-top:1px solid #e2e2e2;padding-top:8px;'>" +
      esc(b.name) + (b.phone ? " · " + esc(b.phone) : "") + (b.email ? " · " + esc(b.email) : "") + (b.siret ? " · SIRET " + esc(b.siret) : "") + "</div>" +
      "</div>";
  }

  function printDoc(doc) {
    printDoc2(doc, findClient(doc.clientId));
  }
  function printDoc2(doc, cl) {
    GW.printHTML(docTitle(doc.kind), docBody(doc, cl, branding()));
  }

  function factures() { return get(K.F); }
  function filterF(list) { var id = cid(); return id ? list.filter(function (x) { return x.clientId === id; }) : list; }
  function factureOf(id) { return factures().filter(function (x) { return x.id === id; })[0] || null; }

  function nextNum(prefix) {
    var seq = load("ga_seq", null) || {};
    var yr = String(new Date().getFullYear());
    var key = prefix + "-" + yr;
    seq[key] = (Number(seq[key]) || 0) + 1;
    GW.save("ga_seq", seq);
    return prefix + "-" + yr + "-" + String(seq[key]).padStart(3, "0");
  }

  GW.printInvoice = function (id) {
    var d = factureOf(id);
    if (!d) { GW.toast("Facture introuvable"); return; }
    printDoc2({ kind: "factures", clientId: d.clientId, num: d.num, date: d.date, echeance: d.echeance, note: d.note, lignes: d.lignes }, findClient(d.clientId));
  };

  /* ==================================================================
     MODULE : ÉDITEUR DE FACTURE
     ================================================================== */
  var invView = { mode: "list", id: null }; // list | edit | brand

  function brandPanel() {
    var b = branding();
    return "<div class='ws-panel ws-panel-sub'><h4>🎨 Identité de l'émetteur (logo ou nom)</h4>" +
      "<p class='ws-hint'>Ces éléments apparaissent sur vos factures imprimées. Le logo est optionnel : sans logo, c'est le nom de l'entreprise qui s'affiche.</p>" +
      "<div class='ws-form'>" +
      "<div class='ws-frow'><label>Logo</label><div style='display:flex;gap:12px;align-items:center;flex-wrap:wrap;'>" +
      (b.logo ? "<img src='" + b.logo + "' alt='logo' style='height:56px;max-width:180px;object-fit:contain;border:1px solid #e2e2e2;border-radius:6px;padding:4px;background:#fff;'>" : "<span class='ws-hint'>Aucun logo (nom seul)</span>") +
      "<input type='file' accept='image/*' id='brand-logo' style='max-width:240px;'>" +
      (b.logo ? "<button type='button' class='mini-btn danger' id='brand-logo-del'>Retirer</button>" : "") +
      "</div></div>" +
      GW.formRow("Nom de l'entreprise", GW.input("b_name", b.name)) +
      GW.formRow("Slogan / activité", GW.input("b_slogan", b.slogan)) +
      GW.formRow("Adresse", GW.input("b_address", b.address)) +
      GW.formRow("SIRET", GW.input("b_siret", b.siret)) +
      GW.formRow("TVA intracom.", GW.input("b_tva", b.tva)) +
      GW.formRow("E-mail", GW.input("b_email", b.email)) +
      GW.formRow("Téléphone", GW.input("b_phone", b.phone)) +
      GW.formRow("IBAN", GW.input("b_iban", b.iban)) +
      GW.formRow("BIC", GW.input("b_bic", b.bic)) +
      GW.formRow("Couleur d'accent", GW.input("b_accent", b.accent, "#0CB5A6")) +
      "<div class='ws-frow ws-frow-full'><label>Mentions de bas de page</label>" + GW.textarea("b_mentions", b.mentions, "Pénalités de retard, TVA, etc.", 3) + "</div>" +
      "</div>" +
      "<div class='ws-actions'><button class='admin-btn' type='button' id='brand-save'>💾 Enregistrer l'identité</button></div></div>";
  }

  function lineRowHTML(l) {
    l = l || { des: "", qte: 1, pu: "", tva: 20 };
    return "<tr class='inv-line'>" +
      "<td><input class='inv-des' value='" + esc(l.des) + "' placeholder='Désignation'></td>" +
      "<td><input class='inv-qte' type='number' step='0.01' min='0' value='" + (l.qte == null ? 1 : l.qte) + "' style='width:80px;'></td>" +
      "<td><input class='inv-pu' type='number' step='0.01' min='0' value='" + esc(l.pu) + "' style='width:100px;'></td>" +
      "<td><select class='inv-tva'>" + vatRates().map(function (r) { return "<option value='" + r + "'" + (Number(l.tva) === r ? " selected" : "") + ">" + String(r).replace(".", ",") + " %</option>"; }).join("") + "</select></td>" +
      "<td class='right inv-tot'>—</td>" +
      "<td><button type='button' class='mini-btn danger inv-rm'>✕</button></td></tr>";
  }

  function editorHTML() {
    var doc = invView.id ? factureOf(invView.id) : null;
    var lignes = doc ? (doc.lignes || []) : [{ des: "", qte: 1, pu: "", tva: 20 }];
    return "<div class='ws-panel'><h3>" + (doc ? "🧾 Modifier la facture " + esc(doc.num) : "🧾 Nouvelle facture") + "</h3>" +
      "<p class='ws-hint'>Rédigez la facture, choisissez le logo ou le nom de l'émetteur (bouton « Identité / logo » dans la liste), puis <b>Enregistrer + Imprimer</b> pour obtenir un PDF. L'aperçu se met à jour en direct.</p>" +
      "<div class='ws-form'>" +
      GW.formRow("Client", GW.select("clientId", clientsOptions(), doc ? (doc.clientId || "") : (cid() || ""))) +
      GW.formRow("Numéro", GW.input("num", doc ? doc.num : "", "Laisser vide = numérotation automatique")) +
      GW.formRow("Date", GW.input("date", doc ? doc.date : today(), "", "type='date'")) +
      GW.formRow("Échéance", GW.input("echeance", doc ? doc.echeance : "", "", "type='date'")) +
      GW.formRow("Objet / note", GW.input("note", doc ? doc.note : "", "Prestation…")) +
      GW.formRow("Statut", GW.select("statut", FA_STATUS, doc ? doc.statut : "en_attente")) +
      "<div class='ws-frow ws-frow-full'><label>Lignes (TVA par ligne)</label>" +
      "<div class='ws-table-wrap'><table class='ws-table inv-lines'><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total</th><th></th></tr></thead><tbody>" +
      lignes.map(lineRowHTML).join("") + "</tbody></table></div>" +
      "<div class='ws-actions' style='margin-top:8px;'><button type='button' class='mini-btn' id='inv-addline'>＋ Ajouter une ligne</button>" +
      "<span style='margin-left:auto;font-weight:600;'>Total TTC : <span id='inv-grand'>—</span></span></div></div>" +
      "</div>" +
      "<div class='ws-actions'>" +
      "<button class='admin-btn' type='button' id='inv-save'>Enregistrer</button>" +
      "<button class='admin-btn primary' type='button' id='inv-save-print'>💾 Enregistrer + Imprimer / PDF</button>" +
      "<button class='admin-btn admin-btn-ghost' type='button' id='inv-back'>Annuler</button></div>" +
      "<div id='inv-preview'></div></div>";
  }

  function listHTML() {
    var b = branding();
    var list = filterF(factures()).slice().sort(function (a, b2) { return (b.date || "").localeCompare(a.date || ""); });
    var rows = list.map(function (x) {
      var cl = findClient(x.clientId);
      return ["<b>" + esc(x.num || "—") + "</b>", cl ? esc(clientLabel(cl)) : "—", fmtDate(x.date), GW.fmtMoney(docTotals(x.lignes).ttc),
        "<button class='mini-btn' data-edit-inv='" + x.id + "'>✏️ Éditer</button>" +
        "<button class='mini-btn' data-print-inv='" + x.id + "'>🖨️ Imprimer</button>"];
    });
    return "<div class='ws-kpis'>" +
      GW.kpi("Logo émetteur", b.logo ? "Oui" : "Nom seul", esc(b.name)) +
      GW.kpi("Factures", String(filterF(factures()).length), cid() ? clientLabel(findClient(cid())) : "toutes") +
      "</div>" +
      "<div class='ws-actions'><button class='mini-btn primary' id='inv-new'>＋ Nouvelle facture</button>" +
      "<button class='mini-btn' id='inv-brand'>🎨 Identité / logo</button></div>" +
      "<div class='ws-panel'><h3>🧾 Éditeur de facture</h3>" +
      GW.tableHTML(["Numéro", "Client", "Date", "Total TTC", "Actions"], rows, "Aucune facture. Créez-en une pour commencer.") + "</div>";
  }

  GW.register({
    id: "facture", cat: "Suivi financier", name: "Éditeur de facture", icon: "🖨️",
    tag: "Logo · mentions · impression PDF",
    render: function () {
      if (invView.mode === "edit") return editorHTML();
      if (invView.mode === "brand") return "<div class='ws-actions'><button class='mini-btn' id='inv-brand-back'>← Retour aux factures</button></div>" + brandPanel();
      return listHTML();
    },
    afterRender: bindInv
  });

  function currentDocFromForm() {
    var f = main();
    var g = function (n) { var el = $("[name=" + n + "]", f); return el ? el.value.trim() : ""; };
    var lignes = [];
    $$(".inv-line", f).forEach(function (tr) {
      var des = $(".inv-des", tr).value.trim();
      var qte = Number($(".inv-qte", tr).value) || 0;
      var pu = Number($(".inv-pu", tr).value) || 0;
      var tva = Number($(".inv-tva", tr).value) || 0;
      if (des || pu) lignes.push({ des: des, qte: qte, pu: pu, tva: tva });
    });
    return {
      kind: "factures", clientId: $("[name=clientId]", main()) ? $("[name=clientId]", main()).value || null : null,
      num: ($("[name=num]", main()) || {}).value || "",
      date: ($("[name=date]", main()) || {}).value || today(),
      echeance: $("[name=echeance]", main()) ? $("[name=echeance]", main()).value : "",
      note: $("[name=note]", main()) ? $("[name=note]", main()).value.trim() : "",
      statut: $("[name=statut]", main()) ? $("[name=statut]", main()).value : "en_attente",
      lignes: lignes
    };
  }

  function renderPreview() {
    var box = $("#inv-preview");
    if (!box) return;
    var d = currentDocFromForm();
    box.innerHTML = "<div class='ws-panel'><h3>👁️ Aperçu</h3>" +
      "<div style='background:#eef1f5;padding:14px;border-radius:10px;overflow:auto;'>" +
      "<div style='background:#fff;color:#111;max-width:800px;margin:0 auto;padding:30px 34px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.12);'>" +
      docBody(d, findClient(d.clientId), branding()) + "</div></div></div>";
  }

  function recomputeInv() {
    var grand = 0;
    $$("#admin-main .inv-line").forEach(function (tr) {
      var qte = Number($(".inv-qte", tr).value) || 0;
      var pu = Number($(".inv-pu", tr).value) || 0;
      var tva = Number($(".inv-tva", tr).value) || 0;
      var tot = qte * pu * (1 + tva / 100);
      grand += tot;
      $(".inv-tot", tr).textContent = fmtMoney(tot);
    });
    var g = $("#inv-grand"); if (g) g.textContent = fmtMoney(grand);
    renderPreview();
  }

  function bindLine(tr) {
    $$("input, select", tr).forEach(function (el) { el.addEventListener("input", recomputeInv); el.addEventListener("change", recomputeInv); });
    var rm = $(".inv-rm", tr);
    if (rm) rm.addEventListener("click", function () { tr.remove(); recomputeInv(); });
  }

  function saveInv(thenPrint) {
    var d = currentDocFromForm();
    if (!d.lignes.length) { GW.toast("Ajoutez au moins une ligne"); return; }
    var list = factures();
    if (invView.id) {
      list = list.map(function (x) { return x.id === invView.id ? Object.assign({}, x, d) : x; });
    } else {
      d.id = uid();
      if (!d.num) d.num = nextNum("FA");
      if (!d.statut) d.statut = "en_attente";
      list = list.concat([d]);
      invView.id = d.id;
    }
    put(K.F, list);
    var saved = list.filter(function (x) { return x.id === invView.id; })[0];
    if (GW.journal) GW.journal("Facture " + (thenPrint ? "émise" : "enregistrée"), (saved.num || "") + " · " + clientLabel(findClient(saved.clientId)));
    GW.toast("Facture enregistrée");
    if (thenPrint) printDoc2({ kind: "factures", clientId: saved.clientId, num: saved.num, date: saved.date, echeance: saved.echeance, note: saved.note, lignes: saved.lignes }, findClient(saved.clientId));
    invView = { mode: "list", id: null };
    GW.render();
  }

  function saveBrandFromPanel() {
    var b = branding();
    var g = function (n) { var el = $("[name=" + n + "]"); return el ? el.value.trim() : ""; };
    b.name = g("b_name") || b.name;
    b.slogan = g("b_slogan");
    b.address = g("b_address");
    b.siret = g("b_siret");
    b.tva = g("b_tva");
    b.email = g("b_email");
    b.phone = g("b_phone");
    b.iban = g("b_iban");
    b.bic = g("b_bic");
    b.accent = g("b_accent") || "#0CB5A6";
    var m = $("[name=b_mentions]"); if (m) b.mentions = m.value.trim();
    saveBrand(b);
    GW.toast("Identité enregistrée");
  }

  function bindInv() {
    var f = main();
    var nw = $("#inv-new"); if (nw) nw.addEventListener("click", function () { invView = { mode: "edit", id: null }; GW.render(); });
    var br = $("#inv-brand"); if (br) br.addEventListener("click", function () { invView = { mode: "brand", id: null }; GW.render(); });
    var brb = $("#inv-brand-back"); if (brb) brb.addEventListener("click", function () { invView = { mode: "list", id: null }; GW.render(); });
    $$("[data-edit-inv]", f).forEach(function (b) { b.addEventListener("click", function () { invView = { mode: "edit", id: b.getAttribute("data-edit-inv") }; GW.render(); }); });
    $$("[data-print-inv]", f).forEach(function (b) { b.addEventListener("click", function () { GW.printInvoice(b.getAttribute("data-print-inv")); }); });

    if (invView.mode === "edit") {
      recomputeInv();
      var add = $("#inv-addline");
      if (add) add.addEventListener("click", function () {
        $(".inv-lines tbody", f).insertAdjacentHTML("beforeend", lineRowHTML(null));
        recomputeInv();
        bindLine($(".inv-lines tbody", f).lastElementChild);
      });
      $$(".inv-line", f).forEach(bindLine);
      $$("[name=clientId],[name=date],[name=echeance],[name=note],[name=num],[name=statut]", f).forEach(function (el) {
        el.addEventListener("input", renderPreview); el.addEventListener("change", renderPreview);
      });
      var bs = $("#inv-save"); if (bs) bs.addEventListener("click", function () { saveInv(false); });
      var bsp = $("#inv-save-print"); if (bsp) bsp.addEventListener("click", function () { saveInv(true); });
      var back = $("#inv-back"); if (back) back.addEventListener("click", function () { invView = { mode: "list", id: null }; GW.render(); });
    }

    if (invView.mode === "brand") {
      var logo = $("#brand-logo");
      if (logo) logo.addEventListener("change", function () {
        var file = logo.files && logo.files[0];
        if (!file) return;
        resizeImage(file, 600, function (dataUrl) { var b = branding(); b.logo = dataUrl; saveBrand(b); GW.toast("Logo enregistré"); GW.render(); });
      });
      var del = $("#brand-logo-del");
      if (del) del.addEventListener("click", function () { var b = branding(); b.logo = ""; saveBrand(b); GW.toast("Logo retiré"); GW.render(); });
      var bsave = $("#brand-save");
      if (bsave) bsave.addEventListener("click", saveBrandFromPanel);
    }
  }

  /* ==================================================================
     MODULE : NOTES DE FRAIS
     ================================================================== */
  var NF_CAT = ["Déplacement", "Repas", "Fournitures", "Hébergement", "Péage / carburant", "Abonnement", "Autre"];
  var NF_ST = { a_rembourser: ["À rembourser", "warn"], rembourse: ["Remboursé", "ok"], refacture: ["Refacturé", "ok"] };
  var nfView = { mode: "list", id: null };

  function notes() { return get(K.NF); }
  function setNotes(l) { put(K.NF, l); }
  function notesFor() { var id = cid(); return id ? notes().filter(function (x) { return x.clientId === id; }) : notes(); }
  function htOf(x) { var ttc = Number(x.ttc) || 0; var tva = Number(x.tva) || 0; return ttc / (1 + tva / 100); }

  function nfListHTML() {
    var list = notesFor().slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var totalTTC = list.reduce(function (s, x) { return s + (Number(x.ttc) || 0); }, 0);
    var attente = list.filter(function (x) { return x.statut === "a_rembourser"; }).reduce(function (s, x) { return s + (Number(x.ttc) || 0); }, 0);
    var rows = list.map(function (x) {
      var cl = findClient(x.clientId);
      return [fmtDate(x.date), cl ? esc(clientLabel(cl)) : "—", esc(x.objet || "—"), esc(x.categorie || "—"),
        fmtMoney(htOf(x)), (Number(x.tva) || 0) + " %", fmtMoney(x.ttc),
        GW.badge((NF_ST[x.statut] || [x.statut || "—"])[0], (NF_ST[x.statut] || ["", "grey"])[1]),
        "<button class='mini-btn' data-edit-nf='" + x.id + "'>✏️</button><button class='mini-btn danger' data-del-nf='" + x.id + "'>✕</button>"];
    });
    return "<div class='ws-kpis'>" +
      GW.kpi("Total notes de frais", fmtMoney(totalTTC), list.length + " note(s)") +
      GW.kpi("À rembourser", fmtMoney(attente), "en attente", attente ? "warn" : "") +
      "</div>" +
      "<div class='ws-actions'><button class='mini-btn primary' id='nf-new'>＋ Nouvelle note de frais</button>" +
      "<button class='mini-btn' id='nf-xls'>Exporter Excel</button></div>" +
      "<div class='ws-panel'><h3>🧾 Notes de frais</h3>" +
      GW.tableHTML(["Date", "Client", "Objet", "Catégorie", "HT", "TVA", "TTC", "Statut", "Actions"], rows, "Aucune note de frais.") + "</div>";
  }

  function nfFormHTML() {
    var n = nfView.id ? notes().filter(function (x) { return x.id === nfView.id; })[0] : null;
    return "<div class='ws-panel'><h3>" + (n ? "✏️ Modifier la note de frais" : "＋ Nouvelle note de frais") + "</h3><div class='ws-form'>" +
      GW.formRow("Date", GW.input("n_date", n ? n.date : today(), "", "type='date'")) +
      GW.formRow("Client", GW.select("n_clientId", clientsOptions(), n ? (n.clientId || "") : (cid() || ""))) +
      GW.formRow("Objet", GW.input("n_objet", n ? n.objet : "", "Ex : déplacement client, repas…")) +
      GW.formRow("Catégorie", GW.select("n_cat", NF_CAT, n ? n.categorie : NF_CAT[0])) +
      GW.formRow("Montant TTC (€)", GW.money("n_ttc", n ? n.ttc : "")) +
      GW.formRow("TVA (%)", GW.select("n_tva", vatRates().map(function (r) { return { v: r, l: String(r).replace(".", ",") + " %" }; }), n ? n.tva : 20)) +
      GW.formRow("Statut", GW.select("n_statut", [{ v: "a_rembourser", l: "À rembourser" }, { v: "rembourse", l: "Remboursé" }, { v: "refacture", l: "Refacturé" }], n ? n.statut : "a_rembourser")) +
      "<div class='ws-frow ws-frow-full'><label>Note</label>" + GW.textarea("n_notes", n ? n.notes : "", "Détails, justificatif…", 3) + "</div>" +
      "</div><div class='ws-actions'><button class='admin-btn' id='nf-save'>Enregistrer</button><button class='admin-btn admin-btn-ghost' id='nf-back'>Annuler</button></div></div>";
  }

  function exportNF(list) {
    GW.exportExcel("gestaffaires-notes-de-frais.xls", {
      head: ["Date", "Client", "Objet", "Catégorie", "HT", "TVA", "TTC", "Statut", "Note"],
      body: list.map(function (x) {
        var cl = findClient(x.clientId);
        return [x.date, cl ? clientLabel(cl) : "", x.objet || "", x.categorie || "", htOf(x).toFixed(2), Number(x.tva) || 0, Number(x.ttc) || 0, (NF_ST[x.statut] || [x.statut || ""])[0], x.notes || ""];
      })
    });
  }

  function saveNF() {
    var f = main();
    var g = function (n) { var el = $("[name=" + n + "]", f); return el ? el.value.trim() : ""; };
    var ttc = Number(g("n_ttc")) || 0;
    if (!g("n_objet")) { GW.toast("Indiquez un objet"); return; }
    if (!ttc) { GW.toast("Indiquez un montant"); return; }
    var data = {
      date: g("n_date") || today(), clientId: g("n_clientId") || null, objet: g("n_objet"),
      categorie: g("n_cat"), ttc: ttc, tva: Number(g("n_tva")) || 0, statut: g("n_statut") || "a_rembourser",
      notes: $("[name=n_notes]", f) ? $("[name=n_notes]", f).value.trim() : ""
    };
    var list = notes();
    if (nfView.id) list = list.map(function (x) { return x.id === nfView.id ? Object.assign({}, x, data) : x; });
    else { data.id = uid(); list = list.concat([data]); }
    setNotes(list);
    if (GW.journal) GW.journal("Note de frais " + (nfView.id ? "modifiée" : "ajoutée"), data.objet + " · " + fmtMoney(ttc));
    GW.toast("Note de frais enregistrée");
    nfView = { mode: "list", id: null };
    GW.render();
  }

  GW.register({
    id: "notes_frais", cat: "Suivi financier", name: "Notes de frais", icon: "🧾",
    tag: "Frais par client · dossier",
    render: function () { return nfView.mode === "form" ? nfFormHTML() : nfListHTML(); },
    afterRender: function () {
      var f = main();
      var nw = $("#nf-new"); if (nw) nw.addEventListener("click", function () { nfView = { mode: "form", id: null }; GW.render(); });
      var xls = $("#nf-xls"); if (xls) xls.addEventListener("click", function () { exportNF(notesFor()); });
      if (nfView.mode === "form") {
        var save = $("#nf-save"); if (save) save.addEventListener("click", saveNF);
        var back = $("#nf-back"); if (back) back.addEventListener("click", function () { nfView = { mode: "list", id: null }; GW.render(); });
      } else {
        $$("[data-edit-nf]", f).forEach(function (b) { b.addEventListener("click", function () { nfView = { mode: "form", id: b.getAttribute("data-edit-nf") }; GW.render(); }); });
        $$("[data-del-nf]", f).forEach(function (b) { b.addEventListener("click", function () {
          if (!confirm("Supprimer cette note de frais ?")) return;
          setNotes(notes().filter(function (x) { return x.id !== b.getAttribute("data-del-nf"); }));
          GW.toast("Note supprimée"); GW.render();
        }); });
      }
    }
  });

  /* API exposée pour le dossier client */
  GW.notesFraisFor = function (clientId) { return notes().filter(function (x) { return x.clientId === clientId; }); };
  GW.notesFraisHT = htOf;
  GW.notesFraisStatus = NF_ST;

}(window.GestWorkspace));
