/* ============================================================
   GestAffaires – « Espace de travail + » : MODULE OPÉRATIONS
   - MISSIONS : projets + tâches (checklist, échéances, avancement).
   - AGENDA   : échéancier unifié (tâches, factures, échéances, RDV)
                + événements manuels.
   Clés : ga_missions, ga_agenda. Aucune donnée existante écrasée.
   ============================================================ */

(function (GW) {
  "use strict";

  var K = { M: "ga_missions", AG: "ga_agenda" };
  var MST = ["prospect", "en_cours", "pause", "termine"];
  var MLAB = { prospect: "Prospect", en_cours: "En cours", pause: "En pause", termine: "Terminé" };
  var MKIND = { prospect: "grey", en_cours: "warn", pause: "grey", termine: "ok" };

  function esc(s) { return GW.esc(s); }
  function money(n) { return GW.fmtMoney(n); }
  function dateF(iso) { return GW.fmtDate(iso); }
  function main() { return document.getElementById("admin-main"); }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function cid() { return GW.currentClientId(); }

  function missions() { return GW.get(K.M); }
  function saveMissions(l) { GW.put(K.M, l); }
  function mission(id) { return missions().filter(function (x) { return x.id === id; })[0] || null; }
  function byClient(list) { var c = cid(); return c ? list.filter(function (x) { return x.clientId === c; }) : list; }
  function allTasks(m) { return m.tasks || []; }
  function doneCount(m) { return allTasks(m).filter(function (t) { return t.done; }).length; }
  function progress(m) { var t = allTasks(m); return t.length ? Math.round(doneCount(m) / t.length * 100) : 0; }
  function isLate(t) { return !t.done && t.due && t.due < GW.today(); }

  /* ==================================================================
     MODULE : MISSIONS
     ================================================================== */
  var mView = { mode: "list", id: null };
  var tbM = [];

  function listHTML() {
    var ms = byClient(missions()).slice().sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
    var actives = ms.filter(function (m) { return m.status === "en_cours"; });
    var allT = [];
    ms.forEach(function (m) { allTasks(m).forEach(function (t) { allT.push(t); }); });
    var todo = allT.filter(function (t) { return !t.done; });
    var late = allT.filter(isLate);
    var budget = actives.reduce(function (s, m) { return s + (Number(m.budget) || 0); }, 0);

    var rows = ms.map(function (m) {
      var cl = m.clientId ? GW.findClient(m.clientId) : null;
      var pct = progress(m);
      var bar = "<div style='min-width:90px;'><div style='height:8px;border-radius:6px;background:#e6ebf2;overflow:hidden;'><div style='height:100%;width:" + pct + "%;background:#0CB5A6;'></div></div><small>" + doneCount(m) + "/" + allTasks(m).length + " tâches</small></div>";
      return [
        esc(m.name || ""), cl ? esc(GW.clientLabel(cl)) : "—",
        GW.badge(MLAB[m.status] || m.status || "—", MKIND[m.status] || "grey"),
        m.start ? dateF(m.start) : "—", m.end ? dateF(m.end) : "—",
        m.budget ? money(m.budget) : "—", bar,
        "<button class='mini-btn' data-open='" + m.id + "'>Ouvrir</button><button class='mini-btn danger' data-del='" + m.id + "'>✕</button>"
      ];
    });

    tbM = [{ action: "add", label: "＋ Nouvelle mission", fn: function () { mView = { mode: "new", id: null }; GW.render(); } }];
    return "<div class='ws-kpis'>" +
      GW.kpi("Missions en cours", String(actives.length), ms.length + " au total") +
      GW.kpi("Tâches à faire", String(todo.length), late.length ? late.length + " en retard" : "à jour", late.length ? "warn" : "") +
      GW.kpi("Budget missions", money(budget), "en cours") +
      "</div>" +
      GW.toolbar(tbM) +
      "<div class='ws-panel'><h3>🗂️ Missions & projets</h3>" +
      GW.tableHTML(["Mission", "Client", "Statut", "Début", "Fin", "Budget", "Avancement", "Actions"], rows, "Aucune mission. Créez votre première mission.") +
      "</div>";
  }

  function missionHTML(id) {
    var m = mission(id);
    if (!m) return GW.empty("Mission introuvable.");
    var cl = m.clientId ? GW.findClient(m.clientId) : null;
    var rows = allTasks(m).sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999"); }).map(function (t) {
      var late = isLate(t);
      return [
        "<label style='display:flex;gap:8px;align-items:center;'><input type='checkbox' data-toggle='" + t.id + "'" + (t.done ? " checked" : "") + "> <span style='" + (t.done ? "text-decoration:line-through;opacity:.6;" : "") + "'>" + esc(t.title || "") + "</span></label>",
        t.due ? (late ? "<span class='ws-pill ws-pill-danger'>" + dateF(t.due) + "</span>" : dateF(t.due)) : "—",
        esc(t.assignee || "—"),
        "<button class='mini-btn danger' data-tdel='" + t.id + "'>✕</button>"
      ];
    });
    return "<div class='ws-panel'><h3>" + esc(m.name || "Mission") + "</h3>" +
      "<p class='ws-sub'>" + GW.badge(MLAB[m.status] || m.status || "—", MKIND[m.status] || "grey") +
      (cl ? " · " + esc(GW.clientLabel(cl)) : "") +
      (m.budget ? " · Budget " + money(m.budget) : "") + "</p>" +
      "<div class='ws-actions'><button class='mini-btn' data-edit>Modifier</button><button class='mini-btn admin-btn-ghost' data-back>← Missions</button></div>" +
      (m.description ? "<p class='ws-hint'>" + esc(m.description) + "</p>" : "") +
      "<p>Avancement : <b>" + progress(m) + " %</b> (" + doneCount(m) + "/" + allTasks(m).length + " tâches)</p></div>" +
      "<div class='ws-panel'><h3>✅ Tâches</h3>" +
      "<form id='op-task-form' class='ws-form' style='display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;'>" +
      "<div class='ws-frow' style='flex:1;min-width:200px;'><label>Nouvelle tâche</label><input name='title' placeholder='Ex : relancer le devis'></div>" +
      "<div class='ws-frow'><label>Échéance</label><input name='due' type='date'></div>" +
      "<div class='ws-frow'><label>Assignée à</label><input name='assignee' placeholder='Nom'></div>" +
      "<button class='admin-btn' type='submit'>Ajouter</button></form>" +
      GW.tableHTML(["Tâche", "Échéance", "Assignée à", ""], rows, "Aucune tâche pour cette mission.") + "</div>";
  }

  function missionFormHTML(id) {
    var m = id ? mission(id) : null;
    return "<div class='ws-panel'><h3>" + (m ? "Modifier la mission" : "Nouvelle mission") + "</h3><form id='op-mission-form' class='ws-form'>" +
      GW.formRow("Nom de la mission *", GW.input("name", m ? m.name : "", "Ex : Refonte site vitrine")) +
      GW.formRow("Client", GW.select("clientId", [ { v: "", l: "— Aucun —" } ].concat(GW.getClients().map(function (c) { return { v: c.id, l: GW.clientLabel(c) }; })), m ? (m.clientId || "") : (cid() || ""))) +
      GW.formRow("Statut", GW.select("status", MST.map(function (s) { return { v: s, l: MLAB[s] }; }), m ? m.status : "en_cours")) +
      GW.formRow("Début", GW.input("start", m ? m.start : "", "", "type='date'")) +
      GW.formRow("Fin prévue", GW.input("end", m ? m.end : "", "", "type='date'")) +
      GW.formRow("Budget (€)", GW.money("budget", m ? m.budget : "")) +
      GW.formRow("Description", GW.textarea("description", m ? m.description : "", "Objectifs, périmètre…", 3)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }

  function bindMissionList() {
    GW.bindToolbar(tbM);
    var m = main();
    $$("[data-open]", m).forEach(function (b) { b.addEventListener("click", function () { mView = { mode: "mission", id: b.getAttribute("data-open") }; GW.render(); }); });
    $$("[data-del]", m).forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Supprimer cette mission et ses tâches ?")) return;
        saveMissions(missions().filter(function (x) { return x.id !== b.getAttribute("data-del"); }));
        GW.toast("Mission supprimée"); GW.render();
      });
    });
  }

  function bindMission(id) {
    var m = main();
    var form = $("#op-task-form", m);
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.title.value.trim()) { GW.toast("Saisissez le libellé de la tâche"); return; }
      saveMissions(missions().map(function (x) {
        if (x.id !== id) return x;
        var tasks = (x.tasks || []).concat([{ id: GW.uid(), title: f.title.value.trim(), due: f.due.value || "", assignee: f.assignee.value.trim(), done: false }]);
        return Object.assign({}, x, { tasks: tasks });
      }));
      GW.toast("Tâche ajoutée");
      GW.render();
    });
    $$("[data-toggle]", main()).forEach(function (b) {
      b.addEventListener("change", function () {
        var tid = b.getAttribute("data-toggle");
        saveMissions(missions().map(function (x) {
          if (x.id !== id) return x;
          var tasks = (x.tasks || []).map(function (t) { return t.id === tid ? Object.assign({}, t, { done: !t.done }) : t; });
          return Object.assign({}, x, { tasks: tasks });
        }));
        GW.render();
      });
    });
    $$("[data-tdel]", main()).forEach(function (b) {
      b.addEventListener("click", function () {
        var tid = b.getAttribute("data-tdel");
        saveMissions(missions().map(function (x) {
          if (x.id !== id) return x;
          return Object.assign({}, x, { tasks: (x.tasks || []).filter(function (t) { return t.id !== tid; }) });
        }));
        GW.render();
      });
    });
    var edit = $("[data-edit]", main());
    if (edit) edit.addEventListener("click", function () { mView = { mode: "edit", id: id }; GW.render(); });
    var back = $("[data-back]", main());
    if (back) back.addEventListener("click", function () { mView = { mode: "list", id: null }; GW.render(); });
  }

  function bindMissionForm(id) {
    var form = $("#op-mission-form", main());
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.name.value.trim()) { GW.toast("Le nom de la mission est requis"); return; }
      var data = {
        name: f.name.value.trim(), clientId: f.clientId.value || null, status: f.status.value,
        start: f.start.value || "", end: f.end.value || "", budget: Number(f.budget.value) || 0,
        description: f.description.value.trim()
      };
      var list = missions();
      if (id) list = list.map(function (x) { return x.id === id ? Object.assign({}, x, data) : x; });
      else { data.id = GW.uid(); data.createdAt = new Date().toISOString(); data.tasks = []; list.unshift(data); }
      saveMissions(list);
      GW.toast(id ? "Mission mise à jour" : "Mission créée");
      mView = { mode: id ? "mission" : "list", id: id || null };
      GW.render();
    });
    var back = $("[data-back]", main());
    if (back) back.addEventListener("click", function () { mView = { mode: id ? "mission" : "list", id: id || null }; GW.render(); });
  }

  GW.register({
    id: "missions", cat: "Opérations & suivi", name: "Missions", icon: "🗂️",
    tag: "Projets · tâches · avancement",
    render: function () {
      if (mView.mode === "new" || mView.mode === "edit") return missionFormHTML(mView.id);
      if (mView.mode === "mission") return missionHTML(mView.id);
      return listHTML();
    },
    afterRender: function () {
      if (mView.mode === "new" || mView.mode === "edit") bindMissionForm(mView.id);
      else if (mView.mode === "mission") bindMission(mView.id);
      else bindMissions();
    }
  });
  function bindMissions() {
    /* alias pour éviter une collision de nom avec la boucle de fermeture */
    bindMissionList();
  }

  /* ==================================================================
     MODULE : AGENDA
     ================================================================== */
  var tbA = [];

  function agendaManual() { return GW.get(K.AG); }
  function saveAgenda(l) { GW.put(K.AG, l); }

  /* Éléments dérivés (à échéance) issus des autres modules. */
  function deriveItems() {
    var c = cid();
    var items = [];
    missions().forEach(function (m) {
      if (c && m.clientId !== c) return;
      allTasks(m).forEach(function (t) {
        if (t.done || !t.due) return;
        items.push({ date: t.due, kind: isLate(t) ? "Retard" : "Tâche", title: t.title + (m.name ? " — " + m.name : ""), id: "task:" + t.id });
      });
    });
    GW.get("ga_factures").forEach(function (f) {
      if (c && f.clientId !== c) return;
      if (f.statut === "payee" || !f.echeance) return;
      var tot = GW.docTotals(f.lignes).ttc;
      items.push({ date: f.echeance, kind: f.echeance < GW.today() ? "Retard" : "Facture", title: "Facture " + (f.num || "") + " — " + GW.fmtMoney(tot), id: "fac:" + f.id });
    });
    GW.get("ga_echeances").forEach(function (e) {
      if (c && e.clientId !== c) return;
      if (e.statut === "fait" || !e.date) return;
      items.push({ date: e.date, kind: e.date < GW.today() ? "Retard" : "Échéance", title: (e.type || "Échéance") + " — " + GW.fmtMoney(e.montant), id: "ech:" + e.id });
    });
    GW.get("ga_rdv").forEach(function (r) {
      if (c && r.clientId !== c) return;
      if (!r.date) return;
      items.push({ date: r.date, kind: "RDV", title: (r.qui ? r.qui + " — " : "") + (r.lieu || "Rendez-vous"), id: "rdv:" + r.id });
    });
    agendaManual().forEach(function (e) {
      if (c && e.clientId !== c) return;
      if (e.done || !e.date) return;
      items.push({ date: e.date, kind: "Agenda", title: e.title, id: "ag:" + e.id, manual: true });
    });
    return items;
  }

  function agendaHTML() {
    var all = deriveItems().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var today = GW.today();
    var upcoming = all.filter(function (i) { return i.date >= today; });
    var past = all.filter(function (i) { return i.date < today; });
    function group(list) {
      var byDate = {};
      list.forEach(function (i) { (byDate[i.date] = byDate[i.date] || []).push(i); });
      var out = "";
      Object.keys(byDate).sort().forEach(function (d) {
        var late = d < today;
        out += "<div class='ws-panel' style='padding:10px 14px;'><h4 style='margin:0 0 6px;'>" + (late ? "⚠️ " : "📅 ") + dateF(d) + "</h4>" +
          byDate[d].map(function (i) {
            return "<div style='display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid #eef1f5;'>" +
              "<span>" + GW.badge(i.kind, i.kind === "Retard" ? "danger" : "grey") + " " + esc(i.title) + "</span>" +
              (i.manual ? "<button class='mini-btn danger' data-agdel='" + i.id.slice(3) + "'>✕</button>" : "") + "</div>";
          }).join("") + "</div>";
      });
      return out;
    }
    tbA = [{ action: "add", label: "＋ Ajouter un événement", fn: function () { agendaForm(); } }];
    return "<div class='ws-kpis'>" +
      GW.kpi("À venir", String(upcoming.length), "éléments planifiés") +
      GW.kpi("En retard", String(past.length), "à traiter", past.length ? "warn" : "") +
      "</div>" +
      GW.toolbar(tbA) +
      (past.length ? group(past) : "") +
      (upcoming.length ? group(upcoming) : GW.empty("Rien de planifié. Ajoutez un événement ou créez des tâches."));
  }

  function agendaForm() {
    main().querySelector(".ws-mod-body").innerHTML =
      "<div class='ws-panel'><h3>📅 Nouvel événement</h3><form id='op-ag-form' class='ws-form'>" +
      GW.formRow("Titre *", GW.input("title", "", "Ex : rendez-vous prospect")) +
      GW.formRow("Date", GW.input("date", GW.today(), "", "type='date'")) +
      GW.formRow("Heure", GW.input("time", "", "", "type='time'")) +
      GW.formRow("Client", GW.select("clientId", [ { v: "", l: "— Aucun —" } ].concat(GW.getClients().map(function (c) { return { v: c.id, l: GW.clientLabel(c) }; })), cid() || "")) +
      GW.formRow("Notes", GW.textarea("notes", "", "", 2)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Retour</button></div></form></div>";
    $("#op-ag-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.title.value.trim()) { GW.toast("Titre requis"); return; }
      var list = agendaManual();
      list.push({ id: GW.uid(), clientId: f.clientId.value || null, date: f.date.value || GW.today(), time: f.time.value || "", title: f.title.value.trim(), notes: f.notes.value.trim(), done: false });
      saveAgenda(list);
      GW.toast("Événement ajouté");
      GW.render();
    });
    $("[data-back]").addEventListener("click", function () { GW.render(); });
  }

  function bindAgenda() {
    GW.bindToolbar(tbA);
    $$("[data-agdel]", main()).forEach(function (b) {
      b.addEventListener("click", function () {
        saveAgenda(agendaManual().filter(function (x) { return x.id !== b.getAttribute("data-agdel"); }));
        GW.toast("Événement supprimé");
        GW.render();
      });
    });
  }

  GW.register({
    id: "agenda", cat: "Opérations & suivi", name: "Agenda", icon: "📅",
    tag: "Échéancier unifié",
    render: agendaHTML,
    afterRender: bindAgenda
  });

}(window.GestWorkspace));
