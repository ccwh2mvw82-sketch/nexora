/* ============================================================
   GestAffaires – « Espace de travail + » : MODULE CRM
   Noyau commercial : pipeline de prospects, fiches, activités,
   conversion en client. Lit/écrit les mêmes données que l'ancien
   module Acquisition (clé « ga_prospects ») : aucune donnée perdue.
   Nouvelle clé : « ga_crm_activities » (historique/notes horodatées).
   ============================================================ */

(function (GW) {
  "use strict";

  var K = { P: "ga_prospects", A: "ga_crm_activities" };

  /* Étapes du pipeline (compatibles avec l'existant : « rdv » inclus). */
  var PSTAT = ["nouveau", "contacte", "rdv", "gagne", "perdu"];
  var PLAB = { nouveau: "Nouveau", contacte: "Contacté", rdv: "Rendez-vous", gagne: "Gagné", perdu: "Perdu" };
  var PKIND = { nouveau: "grey", contacte: "grey", rdv: "warn", gagne: "ok", perdu: "danger" };
  var SOURCES = ["Google", "Google Ads", "Facebook", "Instagram", "Bouche-à-oreille", "Salon / réseau", "Mail", "Recommandation", "Autre"];

  var view = { mode: "pipeline", id: null };

  function esc(s) { return GW.esc(s); }
  function money(n) { return GW.fmtMoney(n); }
  function dateF(iso) { return GW.fmtDate(iso); }
  function main() { return document.getElementById("admin-main"); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function cid() { return GW.currentClientId(); }
  function clientLabel(c) { return GW.clientLabel(c); }

  function prospects() { return GW.get(K.P); }
  function saveProspects(list) { GW.put(K.P, list); }
  function acts() { return GW.get(K.A); }
  function actsFor(pid) {
    return acts().filter(function (a) { return a.prospectId === pid; }).sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
  }
  function addAct(pid, type, note) {
    var list = acts();
    list.unshift({ id: GW.uid(), prospectId: pid, date: new Date().toISOString(), type: type || "note", note: note || "" });
    GW.put(K.A, list);
  }
  function byClient(list) {
    var c = cid();
    return c ? list.filter(function (x) { return x.clientId === c; }) : list;
  }
  function prospect(id) {
    return prospects().filter(function (x) { return x.id === id; })[0] || null;
  }
  function val(x) { return Number(x.valeur) || 0; }
  function isActive(x) { return x.statut !== "gagne" && x.statut !== "perdu"; }
  function stageIndex(s) { var i = PSTAT.indexOf(s); return i < 0 ? 0 : i; }

  function typeLabel(t) {
    return { note: "Note", appel: "Appel", mail: "E-mail", rdv: "Rendez-vous", devis: "Devis" }[t] || "Note";
  }

  /* ------------------------------------------------------------------
     VUE PIPELINE
     ------------------------------------------------------------------ */
  var tb = [];
  function pipelineHTML() {
    var pr = byClient(prospects()).slice().sort(function (a, b) {
      var da = a.nextDate || "9999", db = b.nextDate || "9999";
      if (da !== db) return da.localeCompare(db);
      return (b.date || "").localeCompare(a.date || "");
    });
    var actifs = pr.filter(isActive);
    var gagnes = pr.filter(function (x) { return x.statut === "gagne"; });
    var perdus = pr.filter(function (x) { return x.statut === "perdu"; });
    var valeurPipe = actifs.reduce(function (s, x) { return s + val(x); }, 0);
    var totalDecides = gagnes.length + perdus.length;
    var taux = totalDecides ? Math.round(gagnes.length / totalDecides * 100) : 0;
    var retard = actifs.filter(function (x) { return x.nextDate && x.nextDate < GW.today(); }).length;

    var rows = pr.map(function (x) {
      var cl = x.clientId ? GW.findClient(x.clientId) : null;
      var late = isActive(x) && x.nextDate && x.nextDate < GW.today();
      var act = "<button class='mini-btn' data-adv='" + x.id + "'>Étape +</button> " +
        "<button class='mini-btn' data-fiche='" + x.id + "'>Fiche</button> " +
        (x.statut === "gagne" ? "<button class='mini-btn ok' data-adopt='" + x.id + "'>Client</button> " : "") +
        "<button class='mini-btn danger' data-del='" + x.id + "'>✕</button>";
      return [
        esc(x.nom || ""), esc(x.societe || ""),
        esc(x.src || ""), x.tel ? esc(x.tel) : "—",
        val(x) ? money(val(x)) : "—",
        x.nextDate ? (late ? "<span class='ws-pill ws-pill-danger'>" + dateF(x.nextDate) + "</span>" : dateF(x.nextDate)) : "—",
        GW.badge(PLAB[x.statut] || x.statut || "—", PKIND[x.statut] || "grey"),
        cl ? esc(clientLabel(cl)) : "—",
        act
      ];
    });

    tb = [
      { action: "add", label: "＋ Nouveau prospect", fn: function () { view = { mode: "new", id: null }; GW.render(); } }
    ];
    if (rows.length) {
      tb.push({
        action: "xls", label: "Exporter (Excel)", fn: function () {
          GW.exportExcel("crm-pipeline-" + GW.today() + ".xls", {
            head: ["Nom", "Société", "Téléphone", "E-mail", "Source", "Valeur", "Prochaine action", "Étape"],
            body: pr.map(function (x) { return [x.nom, x.societe, x.tel, x.email, x.src, val(x) || "", x.nextDate || "", PLAB[x.statut] || x.statut]; })
          });
        }
      });
    }

    return "<div class='ws-kpis'>" +
      GW.kpi("Prospects actifs", String(actifs.length), retard ? retard + " en retard" : "à jour", retard ? "warn" : "") +
      GW.kpi("Valeur pipeline", money(valeurPipe), "estimation") +
      GW.kpi("Gagnés", String(gagnes.length), taux + " % de réussite", "ok") +
      GW.kpi("Rendez-vous", String(pr.filter(function (x) { return x.statut === "rdv"; }).length), "en cours") +
      "</div>" +
      GW.toolbar(tb) +
      "<div class='ws-panel'><h3>🤝 Pipeline commercial</h3>" +
      GW.tableHTML(["Nom", "Société", "Source", "Tél.", "Valeur", "Prochaine action", "Étape", "Client lié", "Actions"], rows,
        "Aucun prospect. Ajoutez votre premier prospect pour démarrer le suivi.") +
      "</div>";
  }

  /* ------------------------------------------------------------------
     FICHE PROSPECT
     ------------------------------------------------------------------ */
  function ficheHTML(id) {
    var p = prospect(id);
    if (!p) return GW.empty("Prospect introuvable.");
    var hist = actsFor(id);
    var histRows = hist.map(function (a) {
      return [dateF((a.date || "").split("T")[0]), esc(typeLabel(a.type)), esc(a.note || "")];
    });
    var cl = p.clientId ? GW.findClient(p.clientId) : null;
    return "<div class='ws-panel'><h3>" + esc(p.nom || "Prospect") + (p.societe ? " · " + esc(p.societe) : "") + "</h3>" +
      "<p class='ws-sub'>" + GW.badge(PLAB[p.statut] || p.statut || "—", PKIND[p.statut] || "grey") +
      (cl ? " · Client lié : " + esc(clientLabel(cl)) : "") + "</p>" +
      "<div class='ws-actions'>" +
      "<button class='mini-btn' data-edit>Modifier</button>" +
      "<button class='mini-btn' data-adv>Étape suivante</button>" +
      (p.statut === "gagne" ? "<button class='mini-btn ok' data-adopt>Convertir en client</button>" : "") +
      "<button class='mini-btn admin-btn-ghost' data-back>← Retour au pipeline</button>" +
      "</div>" +
      "<div class='ws-kpis'>" +
      GW.kpi("Valeur", val(p) ? money(val(p)) : "—", "estimation") +
      GW.kpi("Source", esc(p.src || "—"), "provenance") +
      GW.kpi("Téléphone", esc(p.tel || "—"), "") +
      GW.kpi("Prochaine action", p.nextDate ? dateF(p.nextDate) : "—", "") +
      "</div>" +
      (p.email ? "<p class='ws-hint'>E-mail : " + esc(p.email) + "</p>" : "") +
      (p.note ? "<p class='ws-hint'>Note : " + esc(p.note) + "</p>" : "") +
      "</div>" +
      "<div class='ws-panel'><h3>📝 Ajouter une activité</h3>" +
      "<form id='crm-act-form' class='ws-form'>" +
      GW.formRow("Type", GW.select("type", [{ v: "note", l: "Note" }, { v: "appel", l: "Appel" }, { v: "mail", l: "E-mail" }, { v: "rdv", l: "Rendez-vous" }, { v: "devis", l: "Devis" }])) +
      GW.formRow("Détail", GW.textarea("note", "", "Compte-rendu, prochaine étape…", 2)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer l'activité</button></div></form></div>" +
      "<div class='ws-panel'><h3>🕘 Historique</h3>" + GW.tableHTML(["Date", "Type", "Détail"], histRows, "Aucune activité enregistrée.") + "</div>";
  }

  /* ------------------------------------------------------------------
     FORMULAIRE PROSPECT (nouveau / édition)
     ------------------------------------------------------------------ */
  function formHTML(id) {
    var p = id ? prospect(id) : null;
    var title = p ? "Modifier le prospect" : "Nouveau prospect";
    return "<div class='ws-panel'><h3>🤝 " + title + "</h3><form id='crm-form' class='ws-form'>" +
      GW.formRow("Nom / prénom *", GW.input("nom", p ? p.nom : "", "Ex : Marc Rousseau")) +
      GW.formRow("Société / activité", GW.input("societe", p ? p.societe : "", "Ex : Plomberie Rousseau")) +
      GW.formRow("Téléphone", GW.input("tel", p ? p.tel : "", "06 00 00 00 00")) +
      GW.formRow("E-mail", GW.input("email", p ? p.email : "", "contact@exemple.fr", "type='email'")) +
      GW.formRow("Source", GW.select("src", SOURCES, p ? p.src : SOURCES[0])) +
      GW.formRow("Étape", GW.select("statut", PSTAT.map(function (s) { return { v: s, l: PLAB[s] }; }), p ? p.statut : "nouveau")) +
      GW.formRow("Valeur estimée (€)", GW.money("valeur", p ? p.valeur : "")) +
      GW.formRow("Prochaine action (date)", GW.input("nextDate", p ? p.nextDate : "", "", "type='date'")) +
      GW.formRow("Note", GW.textarea("note", p ? p.note : "", "Contexte, besoins…", 3)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button>" +
      "<button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form></div>";
  }

  function bindForm(id) {
    var form = $("#crm-form", main());
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.nom.value.trim()) { GW.toast("Le nom du prospect est requis"); return; }
      var data = {
        nom: f.nom.value.trim(),
        societe: f.societe.value.trim(),
        tel: f.tel.value.trim(),
        email: f.email.value.trim(),
        src: f.src.value,
        statut: f.statut.value,
        valeur: Number(f.valeur.value) || 0,
        nextDate: f.nextDate.value || "",
        note: f.note.value.trim()
      };
      var list = prospects();
      if (id) {
        list = list.map(function (x) { return x.id === id ? Object.assign({}, x, data) : x; });
      } else {
        data.id = GW.uid();
        data.date = GW.today();
        data.clientId = cid() || null;
        data.createdAt = new Date().toISOString();
        list.unshift(data);
      }
      saveProspects(list);
      if (id) addAct(id, "note", "Fiche modifiée");
      GW.toast(id ? "Prospect mis à jour" : "Prospect ajouté");
      view = { mode: id ? "fiche" : "pipeline", id: id || null };
      GW.render();
    });
    var back = $("[data-back]", main());
    if (back) back.addEventListener("click", function () { view = { mode: id ? "fiche" : "pipeline", id: id || null }; GW.render(); });
  }

  function convert(p) {
    if (!p) return;
    var clients = GW.getClients();
    if (clients.filter(function (c) { return (c.name === p.nom && c.phone === p.tel) || (p.email && c.email === p.email); }).length) {
      GW.toast("Un client correspondant existe déjà");
      return;
    }
    var nid = GW.uid();
    clients.push({ id: nid, name: p.nom || "", company: p.societe || "", email: p.email || "", phone: p.tel || "", address: "", created: new Date().toISOString() });
    GW.put("ga_clients", clients);
    saveProspects(prospects().map(function (x) { return x.id === p.id ? Object.assign({}, x, { statut: "gagne", clientId: nid }) : x; }));
    addAct(p.id, "note", "Converti en client");
    GW.toast("Prospect converti en client");
  }

  function bindPipeline() {
    GW.bindToolbar(tb);
    var m = main();
    $$("[data-adv]", m).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-adv");
        saveProspects(prospects().map(function (x) {
          if (x.id !== id) return x;
          var s = PSTAT[Math.min(stageIndex(x.statut) + 1, PSTAT.length - 1)];
          return Object.assign({}, x, { statut: s });
        }));
        GW.render();
      });
    });
    $$("[data-fiche]", m).forEach(function (b) {
      b.addEventListener("click", function () { view = { mode: "fiche", id: b.getAttribute("data-fiche") }; GW.render(); });
    });
    $$("[data-del]", m).forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Supprimer ce prospect ?")) return;
        saveProspects(prospects().filter(function (x) { return x.id !== b.getAttribute("data-del"); }));
        GW.toast("Prospect supprimé");
        GW.render();
      });
    });
    $$("[data-adopt]", m).forEach(function (b) {
      b.addEventListener("click", function () { convert(prospect(b.getAttribute("data-adopt"))); GW.render(); });
    });
  }

  function bindFiche(id) {
    var m = main();
    var form = $("#crm-act-form", m);
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.note.value.trim()) { GW.toast("Saisissez le détail de l'activité"); return; }
      addAct(id, f.type.value, f.note.value.trim());
      GW.toast("Activité enregistrée");
      GW.render();
    });
    var edit = $("[data-edit]", m);
    if (edit) edit.addEventListener("click", function () { view = { mode: "edit", id: id }; GW.render(); });
    var adv = $("[data-adv]", m);
    if (adv) adv.addEventListener("click", function () {
      saveProspects(prospects().map(function (x) {
        if (x.id !== id) return x;
        var s = PSTAT[Math.min(stageIndex(x.statut) + 1, PSTAT.length - 1)];
        return Object.assign({}, x, { statut: s });
      }));
      GW.render();
    });
    var adopt = $("[data-adopt]", m);
    if (adopt) adopt.addEventListener("click", function () { convert(prospect(id)); GW.render(); });
    var back = $("[data-back]", m);
    if (back) back.addEventListener("click", function () { view = { mode: "pipeline", id: null }; GW.render(); });
  }

  GW.register({
    id: "crm",
    cat: "Commercial",
    name: "CRM",
    tag: "Prospects · pipeline · activités",
    icon: "🤝",
    render: function () {
      if (view.mode === "new" || view.mode === "edit") return formHTML(view.mode === "edit" ? view.id : null);
      if (view.mode === "fiche") return ficheHTML(view.id);
      return pipelineHTML();
    },
    afterRender: function () {
      if (view.mode === "new" || view.mode === "edit") bindForm(view.mode === "edit" ? view.id : null);
      else if (view.mode === "fiche") bindFiche(view.id);
      else bindPipeline();
    }
  });

}(window.GestWorkspace));
