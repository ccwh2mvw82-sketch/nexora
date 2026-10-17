/* ============================================================
   GestAffaires – « Espace de travail + » : DOSSIERS ADMIN AVANCÉS
   - Documents : registre + pièces chiffrées (coffre AES-GCM, IndexedDB),
     métadonnées, catégories, échéances (rétention RGPD). Remplace le
     stockage base64 du module « Dossiers ».
   - Équipe : comptes et rôles (admin / collaborateur / client).
   - Journal : journal d'activité (audit).
   Clés : ga_doc_meta, ga_users, ga_journal.
   ============================================================ */

(function (GW) {
  "use strict";
  if (!GW) return;

  var esc = GW.esc, dateF = GW.fmtDate, today = GW.today;
  var findClient = GW.findClient, clientLabel = GW.clientLabel;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var main = function () { return document.getElementById("admin-main"); };
  function cid() { return GW.currentClientId(); }
  function by(list) { var id = cid(); return id ? list.filter(function (x) { return x.clientId === id; }) : list; }
  function bytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " Mo" : Math.max(1, Math.round((n || 0) / 1024)) + " Ko"; }

  /* Journal d'activité, réutilisable par les autres modules. */
  function journal(action, detail) {
    var list = GW.get("ga_journal");
    list.unshift({ id: GW.uid(), ts: new Date().toISOString(), action: action, detail: detail || "" });
    GW.put("ga_journal", list.slice(0, 500));
  }
  GW.journal = journal;

  /* ==================================================================
     MODULE : DOCUMENTS (GED chiffrée)
     ================================================================== */
  var DOC_CATS = ["Contrat", "Devis", "Facture", "Justificatif", "Courrier", "Administratif", "Autre"];
  var dView = { mode: "list" };
  var tbD = [];
  function docMeta() { return GW.get("ga_doc_meta"); }
  function saveDocMeta(l) { GW.put("ga_doc_meta", l); }

  function documentsHTML() {
    var st = GW.vault && GW.vault.status ? GW.vault.status() : { supported: false, unlocked: false };
    var meta = by(docMeta());
    var exp = docMeta().filter(function (m) { return m.expiry && m.expiry < today(); }).length;
    tbD = [
      { action: "add", label: "＋ Ajouter une pièce", fn: function () { dView = { mode: "form" }; GW.render(); } }
    ];
    return "<div class='ws-kpis'>" +
      GW.kpi("Documents", String(docMeta().length), "fichiers référencés") +
      GW.kpi("Coffre", GW.vault && GW.vault.status().unlocked ? "Déverrouillé" : (GW.vault.status().configured ? "Verrouillé" : "À créer"), "chiffrement AES-256", GW.vault.status().unlocked ? "ok" : "warn") +
      GW.kpi("Échéances", String(by(docMeta()).filter(function (x) { return x.expiry; }).length), "révision / rétention") +
      "</div>" +
      GW.toolbar(tbD) +
      "<div class='ws-panel'><h3>📁 Documents</h3><div id='doc-list'><p class='ws-hint'>Chargement…</p></div></div>";
  }

  function docForm() {
    return "<div class='ws-panel'><h3>📎 Ajouter un document</h3><form id='ad-doc-form' class='ws-form'>" +
      GW.formRow("Client", GW.select("clientId", [{ v: "", l: "— Aucun —" }].concat(GW.getClients().map(function (c) { return { v: c.id, l: clientLabel(c) }; })), cid() || "")) +
      GW.formRow("Titre", GW.input("titre", "", "Ex : contrat signé 2026")) +
      GW.formRow("Catégorie", GW.select("cat", DOC_CATS, "Contrat")) +
      GW.formRow("Date du document", GW.input("date", today(), "", "type='date'")) +
      GW.formRow("Échéance / à revoir le", GW.input("expiry", "", "", "type='date'")) +
      GW.formRow("Fichier (PDF, image…)", "<input type='file' name='fichier'>") +
      GW.formRow("Note", GW.textarea("note", "", "Contexte, référence…", 2)) +
      "<div class='ws-actions'><button class='admin-btn' type='submit'>Enregistrer</button><button class='admin-btn admin-btn-ghost' type='button' data-back>Annuler</button></div></form>" +
      "<p class='ws-hint'>Les fichiers sont chiffrés (AES-256-GCM) et stockés dans ce navigateur. Le coffre doit être déverrouillé (module « Sécurité »). En mode cloud, les métadonnées sont synchronisées.</p></div>";
  }

  function renderDocList() {
    var box = $("#doc-list");
    if (!box) return;
    if (!GW.files) { box.innerHTML = GW.empty("Stockage de fichiers indisponible."); return; }
    GW.files.list(cid()).then(function (files) {
      var meta = by(docMeta());
      var byId = {}; meta.forEach(function (m) { if (m.fileId) byId[m.fileId] = m; });
      if (!files.length) { box.innerHTML = GW.empty("Aucune pièce. Ajoutez un document (PDF, scan, justificatif…)."); return; }
      var rows = files.map(function (f) {
        var m = byId[f.id] || {};
        return [esc(m.titre || f.name), esc(m.cat || "—"), (f.size ? bytes(f.size) : "—"),
          (m.date ? dateF(m.date) : "—"), (m.expiry ? dateF(m.expiry) : "—"),
          "<button class='mini-btn' data-dl='" + f.id + "'>Ouvrir</button><button class='mini-btn danger' data-rm='" + f.id + "'>✕</button>"];
      });
      box.innerHTML = GW.tableHTML(["Titre", "Catégorie", "Taille", "Date", "Échéance", "Actions"], rows, "Aucune pièce.");
      $$("[data-dl]", box).forEach(function (b) { b.addEventListener("click", function () { openFile(b.getAttribute("data-dl")); }); });
      $$("[data-rm]", box).forEach(function (b) { b.addEventListener("click", function () {
        if (!confirm("Supprimer cette pièce ?")) return;
        var id = b.getAttribute("data-rm");
        GW.files.remove(id).then(function () {
          GW.put("ga_doc_meta", GW.get("ga_doc_meta").filter(function (x) { return x.fileId !== id; }));
          journal("Suppression document", id); GW.toast("Pièce supprimée"); renderDocList();
        });
      }); });
    }).catch(function () { box.innerHTML = GW.empty("Coffre verrouillé : déverrouillez-le dans « Sécurité »."); });
  }

  function openFile(id) {
    GW.files.open(id).then(function (f) {
      if (!f) { GW.toast("Fichier introuvable"); return; }
      var url = URL.createObjectURL(f.blob);
      var a = document.createElement("a");
      a.href = url; a.download = f.name || "document"; a.target = "_blank";
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
    }).catch(function (e) { GW.toast(e.message || "Ouverture impossible"); });
  }

  function bindDocuments() {
    if (dView.mode === "form") {
      var form = $("#ad-doc-form"); if (!form) return;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var f = e.target;
        var titre = f.titre.value.trim();
        if (!titre) { GW.toast("Donnez un titre"); return; }
        var file = f.fichier.files[0];
        var status = GW.vault && GW.vault.status ? GW.vault.status() : {};
        if (!file) { GW.toast("Choisissez un fichier"); return; }
        if (!status.unlocked) { GW.toast("Déverrouillez d'abord le coffre (module Sécurité)"); return; }
        GW.files.addFile(f.clientId.value || null, file).then(function (fid) {
          var meta = GW.get("ga_doc_meta");
          meta.push({ id: GW.uid(), fileId: fid, clientId: f.clientId.value || null, titre: titre, cat: f.cat.value, date: f.date.value || today(), expiry: f.expiry.value || "", note: f.note.value.trim() });
          GW.put("ga_doc_meta", meta);
          journal("Ajout document", titre);
          GW.toast("Document ajouté"); dView = { mode: "list" }; GW.render();
        }).catch(function (err) { GW.toast(err.message || "Échec du stockage"); });
      });
      $("[data-back]", main()).addEventListener("click", function () { dView = { mode: "list" }; GW.render(); });
      return;
    }
    GW.bindToolbar(tbD);
    renderDocList();
  }

  GW.register({ id: "documents", cat: "Dossiers admin", name: "Documents", icon: "📁", tag: "GED chiffrée · métadonnées",
    render: function () { return dView.mode === "form" ? docForm() : documentsHTML(); }, afterRender: bindDocuments });

  /* ==================================================================
     MODULE : ÉQUIPE (comptes & rôles)
     ================================================================== */
  var RSTAT = { admin: ["Administrateur", "warn"], responsable: ["Responsable", "ok"], collaborateur: ["Collaborateur", "grey"], client: ["Client", "grey"] };
  function equipeHTML() {
    var users = GW.get("ga_users");
    var rows = users.map(function (u) {
      return [esc(u.name || "—"), esc(u.login || u.email || "—"), esc(u.email || "—"),
        GW.badge((RSTAT[u.role] || [u.role || "—"])[0], (RSTAT[u.role] || ["", "grey"])[1]),
        "<select class='mini-select' data-role='" + u.id + "'>" + ["admin", "responsable", "collaborateur", "client"].map(function (r) { return "<option value='" + r + "'" + (u.role === r ? " selected" : "") + ">" + RSTAT[r][0] + "</option>"; }).join("") + "</select>"];
    });
    return "<div class='ws-kpis'>" +
      GW.kpi("Comptes", String(users.length), "utilisateurs") +
      GW.kpi("Admins", String(users.filter(function (u) { return u.role === "admin"; }).length), "accès complet") +
      GW.kpi("Collaborateurs", String(users.filter(function (u) { return u.role === "collaborateur" || u.role === "responsable"; }).length), "équipe") +
      "</div>" +
      "<div class='ws-panel'><h3>👥 Comptes & rôles</h3>" +
      "<p class='ws-hint'>Un seul compte administrateur, des collaborateurs, et des comptes clients (portail). Le changement de rôle s'applique au prochain chargement.</p>" +
      GW.tableHTML(["Nom", "Identifiant", "E-mail", "Rôle", "Modifier"], rows, "Aucun compte.") + "</div>";
  }
  function bindEquipe() {
    $$("[data-role]", main()).forEach(function (sel) {
      sel.addEventListener("change", function () {
        var id = sel.getAttribute("data-role");
        var users = GW.get("ga_users").map(function (u) { return u.id === id ? Object.assign({}, u, { role: sel.value }) : u; });
        GW.put("ga_users", users);
        journal("Changement de rôle", id + " → " + sel.value);
        GW.toast("Rôle mis à jour");
      });
    });
  }
  GW.register({ id: "equipe", cat: "Dossiers admin", name: "Équipe", icon: "👥", tag: "Comptes · rôles",
    render: equipeHTML, afterRender: bindEquipe });

  /* ==================================================================
     MODULE : JOURNAL (audit)
     ================================================================== */
  function journalHTML() {
    var list = GW.get("ga_journal");
    var rows = list.slice(0, 200).map(function (x) {
      return [ (x.ts ? dateF(String(x.ts).slice(0, 10)) + " " + String(x.ts).slice(11, 16) : "—"), esc(x.action || "—"), esc(x.detail || "") ];
    });
    return "<div class='ws-panel'><h3>🧭 Journal d'activité</h3>" +
      "<p class='ws-hint'>Historique des actions sensibles (ajout/suppression de documents, changements de rôle…).</p>" +
      GW.tableHTML(["Quand", "Action", "Détail"], rows, "Aucune activité enregistrée.") + "</div>";
  }
  GW.register({ id: "journal", cat: "Dossiers admin", name: "Journal", icon: "🧭", tag: "Audit",
    render: journalHTML, afterRender: function () {} });

}(window.GestWorkspace));
