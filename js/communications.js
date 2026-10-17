/* ============================================================
   GestAffaires – « Espace de travail + » : COMMUNICATIONS & PORTAIL
   - MESSAGERIE : rédaction + journalisation des échanges client
                  (e-mail via Edge Function, sinon mailto), modèles.
   - MODÈLES     : modèles d'e-mails réutilisables.
   - PORTAIL     : aperçu de ce que le client voit (devis, factures,
                   documents) + fiche à transmettre / imprimer.
   Clés : ga_messages, ga_templates.
   ============================================================ */

(function (GW) {
  "use strict";
  if (!GW) return;

  var esc = GW.esc, fmtDate = GW.fmtDate, money = GW.fmtMoney;
  var findClient = GW.findClient, clientLabel = GW.clientLabel;
  var docTotals = GW.docTotals;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var main = function () { return document.getElementById("admin-main"); };
  var K = { M: "ga_messages", T: "ga_templates" };
  function cid() { return GW.currentClientId(); }
  function filterBy(list) { var id = cid(); return id ? list.filter(function (x) { return x.clientId === id; }) : list; }

  function fill(str, c) {
    if (!c) return str || "";
    return String(str || "")
      .replace(/\{client\}/g, clientLabel(c))
      .replace(/\{societe\}/g, c.company || clientLabel(c))
      .replace(/\{date\}/g, GW.fmtDate(GW.today()));
  }

  function defaultTemplates() {
    return [
      { id: "tpl-relance", name: "Relance facture", subject: "Rappel de facture", body: "Bonjour {client},\n\nSauf erreur de notre part, la facture ci-dessous reste à régler. Nous vous remercions de bien vouloir procéder au règlement.\n\nCordialement,\nGestAffaires" },
      { id: "tpl-devis", name: "Envoi de devis", subject: "Votre devis GestAffaires", body: "Bonjour {client},\n\nVeuillez trouver ci-joint votre devis. N'hésitez pas à nous faire part de vos remarques.\n\nCordialement,\nGestAffaires" },
      { id: "tpl-bienvenue", name: "Bienvenue client", subject: "Bienvenue chez GestAffaires", body: "Bonjour {client},\n\nMerci de votre confiance. Nous sommes ravis de vous accompagner.\n\nCordialement,\nGestAffaires" }
    ];
  }
  function templates() { var t = GW.get(K.T); return t.length ? t : defaultTemplates(); }
  function msgs() { return GW.get(K.M); }

  function sendViaFunction(payload) {
    var conf = (window.GA_CONFIG && window.GA_CONFIG.supabase) || null;
    if (!conf || !conf.url) return Promise.resolve({ ok: false, error: "Supabase non configuré" });
    var base = String(conf.url).replace(/\/+$/, "");
    var key = conf.anonKey || conf.publishableKey || "";
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : null;
    return fetch(base + "/functions/v1/send-message", {
      method: "POST",
      signal: ctrl ? ctrl.signal : undefined,
      headers: { "Content-Type": "application/json", "apikey": key, "Authorization": "Bearer " + key },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) return { ok: false, error: "HTTP " + r.status };
      return r.json().then(function (j) { return { ok: !!(j && j.sent), error: j && j.error }; }).catch(function () { return { ok: true }; });
    }).catch(function () { if (timer) clearTimeout(timer); return { ok: false, error: "fonction indisponible" }; });
  }

  /* ==================================================================
     MODULE : MESSAGERIE
     ================================================================== */
  var mView = { mode: "list", id: null };
  var tbM = [];

  function messagerieHTML() {
    var list = filterBy(msgs()).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var month = GW.today().slice(0, 7);
    var ceMois = msgs().filter(function (x) { return (x.date || "").slice(0, 7) === month; }).length;
    var rows = list.map(function (m) {
      var cl = findClient(m.clientId);
      return [fmtDate(m.date), cl ? esc(clientLabel(cl)) : "—", esc(m.subject || "(sans objet)"),
        GW.badge(m.channel === "note" ? "Note" : "E-mail", "grey"),
        GW.badge(m.status === "sent" ? "Envoyé" : "Journalisé", m.status === "sent" ? "ok" : "warn"),
        "<button class='mini-btn' data-view='" + m.id + "'>Voir</button><button class='mini-btn danger' data-del='" + m.id + "'>✕</button>"];
    });
    tbM = [
      { action: "new", label: "＋ Nouveau message", fn: function () { mView = { mode: "form", id: null }; GW.render(); } },
      { action: "tpl", label: "Modèles", fn: function () { GW.openModule("modeles"); } }
    ];
    return "<div class='ws-kpis'>" +
      GW.kpi("Messages ce mois", String(ceMois), month) +
      GW.kpi("Historique", String(msgs().length), "messages") +
      GW.kpi("Clients", String(GW.getClients().length), "contacts") +
      "</div>" +
      GW.toolbar(tbM) +
      "<div class='ws-panel'><h3>✉️ Historique des messages</h3>" +
      GW.tableHTML(["Date", "Client", "Objet", "Canal", "Statut", "Actions"], rows, "Aucun message.") + "</div>";
  }

  function messagerieForm() {
    var tpls = templates();
    var opts = [{ v: "", l: "— Modèle —" }].concat(tpls.map(function (t) { return { v: t.id, l: t.name }; }));
    return "<div class='ws-panel'><h3>✉️ Nouveau message</h3><form id='msg-form' class='ws-form'>" +
      GW.formRow("Client", GW.select("clientId", [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; })), cid() || "")) +
      GW.formRow("Modèle", GW.select("tpl", opts, "")) +
      GW.formRow("Objet", GW.input("subject", "", "Objet de l'e-mail")) +
      GW.formRow("Message", GW.textarea("body", "", "Votre message…", 8)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Journaliser</button>" +
      "<button class='admin-btn' type='button' id='msg-send'>✉️ Envoyer (e-mail)</button>" +
      "<button class='admin-btn admin-btn-ghost' type='button' id='msg-mail'>Ouvrir dans la messagerie</button>" +
      "<button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form>" +
      "<p class='ws-hint'>L'envoi automatique nécessite la fonction serveur « send-message » (Resend). À défaut, le message est journalisé et peut être ouvert dans votre logiciel de messagerie.</p></div>";
  }

  function messagerieView(id) {
    var m = msgs().filter(function (x) { return x.id === id; })[0];
    if (!m) return GW.empty("Message introuvable.");
    var cl = findClient(m.clientId);
    return "<div class='ws-panel'><h3>✉️ " + esc(m.subject || "(sans objet)") + "</h3>" +
      "<p class='ws-sub'>" + esc(cl ? clientLabel(cl) : "—") + " · " + fmtDate(m.date) + " · " + GW.badge(m.status === "sent" ? "Envoyé" : "Journalisé", m.status === "sent" ? "ok" : "warn") + "</p>" +
      "<pre class='ws-pre'>" + esc(m.body || "") + "</pre>" +
      "<div class='ws-actions'><button class='mini-btn' data-back>← Retour</button></div></div>";
  }

  function bindMessagerie() {
    var m = main();
    if (mView.mode === "list") {
      GW.bindToolbar(tbM);
      $$("[data-view]", m).forEach(function (b) { b.addEventListener("click", function () { mView = { mode: "view", id: b.getAttribute("data-view") }; GW.render(); }); });
      $$("[data-del]", m).forEach(function (b) { b.addEventListener("click", function () { GW.put(K.M, msgs().filter(function (x) { return x.id !== b.getAttribute("data-del"); })); GW.toast("Message supprimé"); GW.render(); }); });
      return;
    }
    if (mView.mode === "view") { var b = $("[data-back]", m); if (b) b.addEventListener("click", function () { mView = { mode: "list", id: null }; GW.render(); }); return; }

    var form = $("#msg-form"); if (!form) return;
    var tplSel = form.querySelector("[name=tpl]");
    tplSel.addEventListener("change", function () {
      var t = templates().filter(function (x) { return x.id === tplSel.value; })[0];
      if (!t) return;
      var c = findClient(form.clientId.value);
      form.subject.value = fill(t.subject, c);
      form.body.value = fill(t.body, c);
    });
    form.clientId.addEventListener("change", function () {
      var t = templates().filter(function (x) { return x.id === tplSel.value; })[0];
      if (t) { var c = findClient(form.clientId.value); form.subject.value = fill(t.subject, c); form.body.value = fill(t.body, c); }
    });
    function collect(status) {
      var cl = findClient(form.clientId.value);
      return {
        id: GW.uid(), clientId: form.clientId.value || null, date: new Date().toISOString(),
        channel: status === "sent" ? "email" : "email", subject: form.subject.value.trim(),
        body: form.body.value, status: status || "log", to: cl ? (cl.email || "") : ""
      };
    }
    function push(rec) { GW.put(K.M, msgs().concat([rec])); }
    form.addEventListener("submit", function (e) { e.preventDefault(); push(collect("log")); GW.toast("Message journalisé"); mView = { mode: "list", id: null }; GW.render(); });
    $("#msg-mail").addEventListener("click", function () {
      var rec = collect("log"); push(rec);
      if (rec.to) { location.href = "mailto:" + rec.to + "?subject=" + encodeURIComponent(rec.subject || "") + "&body=" + encodeURIComponent(rec.body || ""); }
      else { GW.toast("Aucune adresse e-mail pour ce client"); }
      mView = { mode: "list", id: null }; GW.render();
    });
    $("#msg-send").addEventListener("click", function () {
      var rec = collect("log");
      if (!rec.to) { GW.toast("Aucune adresse e-mail pour ce client"); return; }
      sendViaFunction({ to: rec.to, subject: rec.subject, body: rec.body }).then(function (r) {
        rec.status = r.ok ? "sent" : "log";
        push(rec);
        GW.toast(r.ok ? "Message envoyé" : "Envoi indisponible — message journalisé");
        mView = { mode: "list", id: null }; GW.render();
      });
    });
    var back = $("[data-back]", m); if (back) back.addEventListener("click", function () { mView = { mode: "list", id: null }; GW.render(); });
  }

  GW.register({
    id: "messagerie", cat: "Communications & clients", name: "Messagerie", icon: "✉️",
    tag: "E-mails · modèles · historique",
    render: function () { return mView.mode === "form" ? messagerieForm() : (mView.mode === "view" ? messagerieView(mView.id) : messagerieHTML()); },
    afterRender: bindMessagerie
  });

  /* ==================================================================
     MODULE : MODÈLES DE MESSAGE
     ================================================================== */
  var tplView = { mode: "list", id: null };
  var tbTp = [];
  function tplHTML() {
    var list = templates();
    var rows = list.map(function (t) {
      return [esc(t.name), esc(t.subject), "<button class='mini-btn' data-edit='" + t.id + "'>Modifier</button><button class='mini-btn danger' data-del='" + t.id + "'>✕</button>"];
    });
    tbTp = [{ action: "new", label: "＋ Nouveau modèle", fn: function () { tplView = { mode: "form", id: null }; GW.render(); } }];
    return GW.toolbar(tbTp) + "<div class='ws-panel'><h3>🧩 Modèles de message</h3>" +
      "<p class='ws-hint'>Variables disponibles : {client}, {societe}, {date}.</p>" +
      GW.tableHTML(["Nom", "Objet", "Actions"], rows, "Aucun modèle.") + "</div>";
  }
  function tplForm(id) {
    var t = templates().filter(function (x) { return x.id === id; })[0];
    return "<div class='ws-panel'><h3>" + (t ? "Modifier le modèle" : "Nouveau modèle") + "</h3><form id='tpl-form' class='ws-form'>" +
      GW.formRow("Nom", GW.input("name", t ? t.name : "", "Ex : Relance facture")) +
      GW.formRow("Objet", GW.input("subject", t ? t.subject : "", "Objet de l'e-mail")) +
      GW.formRow("Corps", GW.textarea("body", t ? t.body : "", "Bonjour {client}, …", 8)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }
  function bindTpl() {
    var m = main();
    if (tplView.mode === "list") {
      GW.bindToolbar(tbTp);
      $$("[data-edit]", m).forEach(function (b) { b.addEventListener("click", function () { tplView = { mode: "form", id: b.getAttribute("data-edit") }; GW.render(); }); });
      $$("[data-del]", m).forEach(function (b) { b.addEventListener("click", function () { if (!confirm("Supprimer ce modèle ?")) return; GW.put(K.T, templates().filter(function (x) { return x.id !== b.getAttribute("data-del"); })); GW.toast("Modèle supprimé"); GW.render(); }); });
      return;
    }
    var form = $("#tpl-form"); if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var list = templates();
      var data = { name: form.name.value.trim(), subject: form.subject.value.trim(), body: form.body.value };
      if (!data.name) { GW.toast("Nom requis"); return; }
      if (tplView.id) list = list.map(function (x) { return x.id === tplView.id ? Object.assign({}, x, data) : x; });
      else { data.id = GW.uid(); list = list.concat([data]); }
      GW.put(K.T, list); GW.toast("Modèle enregistré"); tplView = { mode: "list", id: null }; GW.render();
    });
    var back = $("[data-back]", m); if (back) back.addEventListener("click", function () { tplView = { mode: "list", id: null }; GW.render(); });
  }
  GW.register({
    id: "modeles", cat: "Communications & clients", name: "Modèles", icon: "🧩",
    tag: "Gabarits d'e-mails",
    render: function () { return tplView.mode === "form" ? tplForm(tplView.id) : tplHTML(); },
    afterRender: bindTpl
  });

  /* ==================================================================
     MODULE : PORTAIL CLIENT (aperçu de l'espace client)
     ================================================================== */
  function portailHTML() {
    var id = cid();
    if (!id) return GW.empty("Sélectionnez un client ci-dessus pour prévisualiser son portail.");
    var c = findClient(id);
    if (!c) return GW.empty("Client introuvable.");
    var F = GW.get(K_F()).filter(function (x) { return x.clientId === id; });
    var D = GW.get(K_D()).filter(function (x) { return x.clientId === id; });
    var docs = GW.get("ga_documents").filter(function (x) { return x.clientId === id; });
    var msg = GW.get(K.M).filter(function (x) { return x.clientId === id && x.status === "sent"; });
    function sum(list) { return list.reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0); }
    return "<div class='ws-kpis'>" +
      GW.kpi("Factures", String(F.length), money(sum(F))) +
      GW.kpi("Devis", String(D.length), money(sum(D))) +
      GW.kpi("Documents", String(docs.length), "partagés") +
      "</div>" +
      "<div class='ws-panel'><h3>👤 Portail de " + esc(clientLabel(c)) + "</h3>" +
      "<p class='ws-hint'>Voici ce que votre client verrait dans son espace : ses devis, factures, documents et messages. L'ouverture réelle du portail nécessite un compte de rôle « client » (voir DATABASE.md).</p>" +
      GW.tableHTML(["Factures", "Date", "Montant TTC", "Statut"], F.map(function (f) { return [esc(f.num || "—"), fmtDate(f.date), money(docTotals(f.lignes).ttc), f.statut === "payee" ? "Payée" : "À régler"]; }), "Aucune facture.") +
      "</div>" +
      "<div class='ws-panel'><h3>📄 Devis</h3>" + GW.tableHTML(["Devis", "Date", "Montant TTC", "Statut"], D.map(function (d) { return [esc(d.num || "—"), fmtDate(d.date), money(docTotals(d.lignes).ttc), esc(d.statut || "")]; }), "Aucun devis.") + "</div>" +
      "<div class='ws-panel'><h3>📎 Documents</h3>" + GW.tableHTML(["Nom", "Type", "Ajouté le"], docs.map(function (x) { return [esc(x.name || x.nom || "—"), esc(x.type || "—"), fmtDate(x.date)]; }), "Aucun document.") + "</div>" +
      "<div class='ws-panel'><h3>✉️ Messages envoyés</h3>" + GW.tableHTML(["Date", "Objet"], msg.map(function (x) { return [fmtDate(x.date), esc(x.subject || "")]; }), "Aucun message envoyé.") + "</div>";
  }
  function K_F() { return "ga_factures"; }
  function K_D() { return "ga_devis"; }

  GW.register({
    id: "portail", cat: "Communications & clients", name: "Portail client", icon: "👤",
    tag: "Ce que voit le client",
    render: portailHTML,
    afterRender: function () {}
  });

}(window.GestWorkspace));
