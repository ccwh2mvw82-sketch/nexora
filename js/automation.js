/* ============================================================
   GestAffaires – « Espace de travail + » : AUTOMATISATIONS
   Actions assistées (exécutées à la demande) :
   - Relancer les factures impayées (crée des relances à traiter).
   - Programmer les échéances du mois dans l'agenda.
   - Accueillir les nouveaux clients (brouillon de message).
   Chaque exécution est tracée dans ga_automation_log.
   ============================================================ */

(function (GW) {
  "use strict";
  if (!GW) return;

  var esc = GW.esc, dateF = GW.fmtDate, today = GW.today;
  var findClient = GW.findClient, clientLabel = GW.clientLabel;
  var docTotals = GW.docTotals;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var main = function () { return document.getElementById("admin-main"); };

  function log(action, detail) {
    var l = GW.get("ga_automation_log");
    l.unshift({ id: GW.uid(), ts: new Date().toISOString(), action: action, detail: detail || "" });
    GW.put("ga_automation_log", l.slice(0, 200));
    if (GW.journal) GW.journal("Automatisation : " + action, detail);
  }

  /* --- Action 1 : relances des impayés ------------------------------ */
  function runRelances() {
    var rel = GW.get("ga_relances");
    var created = 0;
    GW.get("ga_factures").forEach(function (f) {
      if (f.statut !== "en_attente") return;
      if (!f.echeance || f.echeance >= today()) return;
      var already = rel.filter(function (r) { return r.docId === f.id; }).length;
      if (already >= 3) return;
      rel.push({ id: GW.uid(), clientId: f.clientId, docId: f.id, docNum: f.num, stade: already + 1, date: today(), etat: "a_traiter", texte: "" });
      created++;
    });
    GW.put("ga_relances", rel);
    log("Relances impayés", created + " relance(s) créée(s)");
    return created + " relance(s) programmée(s)";
  }

  /* --- Action 2 : échéances du mois dans l'agenda ------------------- */
  function runAgendaEcheances() {
    var ag = GW.get("ga_agenda");
    var created = 0;
    var month = today().slice(0, 7);
    GW.get("ga_echeances").forEach(function (e) {
      if (e.statut === "fait" || !e.date || String(e.date).slice(0, 7) !== month) return;
      var exists = ag.filter(function (a) { return a.src === "echeance:" + e.id; }).length;
      if (exists) return;
      ag.push({ id: GW.uid(), clientId: e.clientId, date: e.date, title: (e.type || "Échéance") + " — " + GW.fmtMoney(e.montant), src: "echeance:" + e.id, done: false, auto: true });
      created++;
    });
    GW.put("ga_agenda", ag);
    log("Échéances → agenda", created + " événement(s)");
    return created + " échéance(s) ajoutée(s) à l'agenda";
  }

  /* --- Action 3 : accueil des nouveaux clients ---------------------- */
  function runAccueil() {
    var msgs = GW.get("ga_messages");
    var since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    var created = 0;
    GW.getClients().forEach(function (c) {
      var created7 = (c.created || "").slice(0, 10);
      if (!created7 || created7 < since) return;
      var already = msgs.filter(function (m) { return m.clientId === c.id && m.kind === "welcome"; }).length;
      if (already) return;
      msgs.push({ id: GW.uid(), clientId: c.id, date: new Date().toISOString(), channel: "email", subject: "Bienvenue chez GestAffaires", body: "Bonjour " + clientLabel(c) + ",\n\nMerci de votre confiance. Toute l'équipe est ravie de vous accompagner.\n\nCordialement,\nGestAffaires", status: "log", kind: "welcome", to: c.email || "" });
      created++;
    });
    GW.put("ga_messages", msgs);
    log("Accueil nouveaux clients", created + " brouillon(s)");
    return created + " message(s) de bienvenue créé(s)";
  }

  var ACTIONS = {
    relances: { label: "🔔 Relancer les factures impayées", fn: runRelances },
    agenda: { label: "📅 Programmer les échéances du mois", fn: runAgendaEcheances },
    accueil: { label: "👋 Accueillir les nouveaux clients", fn: runAccueil }
  };

  function html() {
    var logList = GW.get("ga_automation_log");
    var rows = logList.slice(0, 40).map(function (x) {
      return [ (x.ts ? dateF(String(x.ts).slice(0, 10)) + " " + String(x.ts).slice(11, 16) : "—"), esc(x.action || ""), esc(x.detail || "") ];
    });
    var cards = Object.keys(ACTIONS).map(function (k) {
      return "<div class='ws-panel ws-panel-sub' style='display:flex;justify-content:space-between;align-items:center;gap:12px;'>" +
        "<b>" + ACTIONS[k].label + "</b>" +
        "<button class='mini-btn' data-run='" + k + "'>Exécuter</button></div>";
    }).join("");
    return "<div class='ws-kpis'>" +
      GW.kpi("Actions disponibles", String(Object.keys(ACTIONS).length), "assistants") +
      GW.kpi("Exécutions", String(logList.length), "au total") +
      "</div>" +
      "<div class='ws-panel'><h3>⚙️ Automatisations</h3>" +
      "<p class='ws-hint'>Ces actions préparent le travail pour vous (relances, agenda, messages). Vous gardez toujours la main : rien n'est envoyé automatiquement.</p>" +
      cards + "</div>" +
      "<div class='ws-panel'><h3>🧾 Journal des exécutions</h3>" +
      GW.tableHTML(["Quand", "Action", "Détail"], rows, "Aucune exécution.") + "</div>";
  }

  function bind() {
    $$("[data-run]", main()).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-run");
        var a = ACTIONS[k];
        if (!a) return;
        var res = a.fn();
        GW.toast(a.label.replace(/^[^ ]+ /, "") + " : " + res);
        GW.render();
      });
    });
  }

  GW.register({ id: "automatisations", cat: "Dossiers admin", name: "Automatisations", icon: "⚙️", tag: "Tâches assistées",
    render: html, afterRender: bind });

}(window.GestWorkspace));
