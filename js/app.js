/* ============================================================
   GestAffaires – Espace client & administrateur
   Inscription / connexion (localStorage), gestion des clients,
   factures, devis et contrats, documents imprimables.
   Version démo : données stockées uniquement dans le navigateur.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var LS_USERS = "ga_users";
  var LS_SESSION = "ga_session";
  var LS_CLIENTS = "ga_clients";
  var LS_FACTURES = "ga_factures";
  var LS_DEVIS = "ga_devis";
  var LS_CONTRATS = "ga_contrats";
  var LS_SEQ = "ga_seq";

  /* Code secret requis à l'inscription pour obtenir le rôle admin.
     Les visiteurs sans ce code créent un compte client. */
  var ADMIN_CODE = "GEST-2026";

  /* ---------- Stockage ----------
     Route vers le cloud Supabase (GAB.data) quand il est actif,
     sinon repli sur localStorage (comportement historique). */
  function load(key, def) {
    if (window.GAB && window.GAB.data) return window.GAB.data.load(key, def);
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }
  function save(key, val) {
    if (window.GAB && window.GAB.data) return window.GAB.data.save(key, val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function uid() {
    return "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* Hash léger (démo) – jamais à utiliser côté serveur */
  function hashPass(p) {
    var h = 5381, i;
    p = String(p || "");
    for (i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) | 0;
    }
    return "h" + Math.abs(h).toString(36);
  }

  var LOGO_SVG = '<img class="ps-logo-img" src="assets/logo.png" alt="Logotype GestAffaires">';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }
  function fmtDate(iso) {
    if (!iso) return "";
    try { return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR"); } catch (e) { return iso; }
  }
  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- Utilisateurs ---------- */
  function getUsers() { return load(LS_USERS, []); }
  function setUsers(u) { save(LS_USERS, u); }

  function currentUser() {
    var id = load(LS_SESSION, null);
    if (!id) return null;
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) return users[i];
    }
    return null;
  }

  function isAdmin() {
    var u = currentUser();
    return !!(u && u.role === "admin");
  }

  /* ---------- Fiches (clients, documents) ---------- */
  function getList(key) { return load(key, []); }
  function setList(key, list) { save(key, list); }
  function findClient(id) {
    var list = getList(LS_CLIENTS);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------- Numérotation FA/DE/CT ---------- */
  function nextNum(type, prefix) {
    if (!type || !prefix) return "";
    var seq = load(LS_SEQ, {});
    var year = new Date().getFullYear();
    var key = type + "_" + year;
    var n = (seq[key] || 0) + 1;
    seq[key] = n;
    save(LS_SEQ, seq);
    return prefix + "-" + year + "-" + String(n).padStart(3, "0");
  }

  /* ---------- Totaux d'un document ---------- */
  function docTotals(lines) {
    var ht = 0, tva = 0;
    (lines || []).forEach(function (l) {
      var q = parseFloat(l.qte) || 0;
      var p = parseFloat(l.pu) || 0;
      var v = parseFloat(l.tva) || 0;
      ht += q * p;
      tva += q * p * v / 100;
    });
    return { ht: ht, tva: tva, ttc: ht + tva };
  }
  function lineTotal(l) {
    return (parseFloat(l.qte) || 0) * (parseFloat(l.pu) || 0);
  }

  /* ============================================================
     MODALES AUTH
     ============================================================ */
  /* Si une modale auth est fermée par le X (géré par main.js),
     on retire aussi la classe no-scroll ajoutée à l'ouverture. */
  function watchModalClose(m) {
    if (!m) return;
    new MutationObserver(function () {
      if (m.hidden && modalLogin.hidden && modalRegister.hidden) {
        document.body.classList.remove("no-scroll");
      }
    }).observe(m, { attributes: true, attributeFilter: ["hidden"] });
  }
  var modalLogin = $("#modal-login");
  var modalRegister = $("#modal-register");
  var authErrorLogin = $("#login-error");
  var authErrorRegister = $("#register-error");

  function openModal(m) {
    if (!m) return;
    $$(".modal").forEach(function (o) { o.hidden = true; });
    m.hidden = false;
    document.body.classList.add("no-scroll");
    var c = $(".modal-close", m);
    if (c) { c.focus(); }
  }
  function closeModals() {
    $$(".modal").forEach(function (m) { m.hidden = true; });
    document.body.classList.remove("no-scroll");
  }
  function showErr(el, msg) {
    if (!el) return;
    if (msg) { el.textContent = msg; el.hidden = false; }
    else { el.hidden = true; }
  }

  watchModalClose(modalLogin);
  watchModalClose(modalRegister);

  function registerUser(name, login, email, pass, code) {
    if (window.GAB && window.GAB.auth && window.GAB.auth.available() && window.GAB.ready) {
      window.GAB.auth.register({ name: name, login: login, email: email, pass: pass, code: code })
        .then(function (res) {
          if (res && res.pending) {
            showErr(authErrorRegister, "Compte créé : vérifiez votre boîte e-mail et confirmez votre adresse avant de vous connecter.");
            return;
          }
          closeModals();
          refreshAuthUI();
          if (window.GAB.data) window.GAB.data.refresh().then(function () { openPanel(); });
          else openPanel();
        })
        .catch(function (err) {
          showErr(authErrorRegister, (err && err.message) || "Inscription impossible.");
        });
      return false;
    }
    var users = getUsers();
    name = (name || "").trim();
    login = (login || "").trim();
    email = (email || "").trim();
    code = (code || "").trim();
    if (!name || !login || pass.length < 4) { showErr(authErrorRegister, "Veuillez remplir le nom, l'identifiant et un mot de passe d'au moins 4 caractères."); return false; }
    for (var i = 0; i < users.length; i++) {
      if (users[i].login.toLowerCase() === login.toLowerCase()) { showErr(authErrorRegister, "Cet identifiant est déjà utilisé."); return false; }
      if (email && users[i].email && users[i].email.toLowerCase() === email.toLowerCase()) { showErr(authErrorRegister, "Cet e-mail est déjà utilisé."); return false; }
    }
    if (code && code !== ADMIN_CODE) { showErr(authErrorRegister, "Le code d'inscription est invalide."); return false; }
    var role = code === ADMIN_CODE ? "admin" : "client";
    users.push({ id: uid(), name: name, login: login, email: email, pass: hashPass(pass), role: role, created: new Date().toISOString() });
    setUsers(users);
    save(LS_SESSION, users[users.length - 1].id);
    closeModals();
    refreshAuthUI();
    openPanel();
    return true;
  }

  function loginUser(login, pass) {
    if (window.GAB && window.GAB.auth && window.GAB.auth.available() && window.GAB.ready) {
      window.GAB.auth.login(login, pass)
        .then(function () {
          closeModals();
          refreshAuthUI();
          if (window.GAB.data) window.GAB.data.refresh().then(function () { openPanel(); });
          else openPanel();
        })
        .catch(function (err) {
          showErr(authErrorLogin, (err && err.message) || "Connexion impossible.");
        });
      return false;
    }
    login = (login || "").trim();
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var match = u.login.toLowerCase() === login.toLowerCase() || (u.email && u.email.toLowerCase() === login.toLowerCase());
      if (match && u.pass === hashPass(pass)) {
        save(LS_SESSION, u.id);
        closeModals();
        refreshAuthUI();
        openPanel();
        return true;
      }
    }
    showErr(authErrorLogin, "Identifiant ou mot de passe incorrect.");
    return false;
  }

  function logout() {
    if (window.GAB && window.GAB.auth && window.GAB.auth.available() && window.GAB.ready) {
      window.GAB.auth.logout().then(function () {
        closePanel();
        refreshAuthUI();
      });
      return;
    }
    localStorage.removeItem(LS_SESSION);
    closePanel();
    refreshAuthUI();
  }

  /* ---------- Tête de l'en-tête ---------- */
  function refreshAuthUI() {
    var u = currentUser();
    var avatar = $("#auth-trigger");
    var label = $("[data-auth-label]", avatar);
    if (!avatar || !label) return;
    if (u) {
      label.textContent = u.role === "admin" ? "Espace admin" : "Mon espace";
      avatar.classList.add("is-admin");
      avatar.setAttribute("aria-label", "Ouvrir mon espace");
    } else {
      label.textContent = "Connexion";
      avatar.classList.remove("is-admin");
      avatar.setAttribute("aria-label", "Connexion");
    }
  }

  /* ============================================================
     PANNEAU ESPACE (admin / membre)
     ============================================================ */
  var panel = $("#admin-panel");
  var adminMain = $("#admin-main");
  var adminTabs = $("#admin-tabs");
  var adminRole = $("#admin-role");
  var adminUser = $("#admin-user");
  var activeTab = "dashboard";

  var TABS = [
    { key: "dashboard", label: "Tableau de bord", adminOnly: false },
    { key: "clients", label: "Clients", adminOnly: true },
    { key: "factures", label: "Factures", adminOnly: true },
    { key: "devis", label: "Devis", adminOnly: true },
    { key: "contrats", label: "Contrats", adminOnly: true },
    { key: "workspace", label: "Espace de travail", adminOnly: true }
  ];

  function openPanel() {
    if (!panel) return;
    closeModals();
    var u = currentUser();
    if (!u) { refreshAuthUI(); return; }
    panel.hidden = false;
    document.body.classList.add("no-scroll");
    adminRole.textContent = u.role === "admin" ? "Administrateur" : "Client";
    adminUser.textContent = u.name;
    renderTabs();
    activeTab = u.role === "admin" ? "dashboard" : "dashboard";
    renderActive();
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function renderTabs() {
    var u = currentUser();
    if (!adminTabs) return;
    if (!u) { adminTabs.hidden = true; return; }
    var html = "";
    TABS.forEach(function (t) {
      if (t.adminOnly && u.role !== "admin") return;
      html += '<button class="admin-tab" data-tab="' + t.key + '" role="tab">' + t.label + "</button>";
    });
    adminTabs.hidden = false;
    adminTabs.innerHTML = html;
    $$(".admin-tab", adminTabs).forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTab = btn.getAttribute("data-tab");
        renderActive();
      });
    });
  }

  function renderActive() {
    var u = currentUser();
    if (!u) return;
    var tabs = $$(".admin-tab", adminTabs);
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === activeTab);
    });
    if (u.role === "admin") {
      var fn = { dashboard: renderDashboard, clients: renderClients, factures: renderDocs("factures", "FA"), devis: renderDocs("devis", "DE"), contrats: renderContrats, workspace: renderWorkspace }[activeTab];
      if (fn) fn();
    } else {
      renderMember();
    }
  }

  function renderMember() {
    var u = currentUser();
    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="member-welcome">' +
      '<h2>Bienvenue, ' + esc(u.name) + "</h2>" +
      "<p>Vous êtes connecté(e) à votre espace GestAffaires.</p>" +
      "<p>Compte client : la gestion des documents (factures, devis, contrats) est réservée à l'administrateur.</p>" +
      '<p><a href="#contact" data-panel-close class="btn btn-primary">Contacter GestAffaires</a></p>' +
      "</div></div>";
    var closeLink = $("#admin-main a[data-panel-close]");
    if (closeLink) closeLink.addEventListener("click", closePanel);
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    var clients = getList(LS_CLIENTS);
    var factures = getList(LS_FACTURES);
    var devis = getList(LS_DEVIS);
    var contrats = getList(LS_CONTRATS);
    var factSum = 0, pendingDev = 0;
    factures.forEach(function (f) { if (f.statut !== "annulee") factSum += docTotals(f.lignes).ttc; });
    devis.forEach(function (d) { if (d.statut === "en_attente") pendingDev++; });

    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="admin-head"><div><h2>Tableau de bord</h2><p>Vue d\'ensemble de votre activité.</p></div></div>' +
      '<div class="kpi-grid">' +
      '<div class="kpi-card"><strong>' + clients.length + '</strong><span>Clients</span></div>' +
      '<div class="kpi-card"><strong>' + factures.length + '</strong><span>Factures</span></div>' +
      '<div class="kpi-card"><strong>' + fmtMoney(factSum) + '</strong><span>Montant facturé</span></div>' +
      '<div class="kpi-card"><strong>' + pendingDev + '</strong><span>Devis en attente</span></div>' +
      "</div>" +
      '<div class="admin-card">' +
      "<h3>Actions rapides</h3>" +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
      '<button class="mini-btn primary" data-action="goto" data-tab="factures">Nouvelle facture</button>' +
      '<button class="mini-btn primary" data-action="goto" data-tab="devis">Nouveau devis</button>' +
      '<button class="mini-btn primary" data-action="goto" data-tab="contrats">Nouveau contrat</button>' +
      '<button class="mini-btn primary" data-action="goto" data-tab="clients">Gérer les clients</button>' +
      "</div></div></div>";
    $$("[data-action=goto]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { activeTab = b.getAttribute("data-tab"); renderActive(); });
    });
  }

  /* ---------- Clients ---------- */
  function renderClients() {
    var clients = getList(LS_CLIENTS);
    var rows = clients.length
      ? clients.map(function (c) {
          return "<tr>" +
            "<td class='num-cell'>" + esc(c.name) + "</td>" +
            "<td>" + esc(c.company || "—") + "</td>" +
            "<td>" + esc(c.email || "—") + "</td>" +
            "<td>" + esc(c.phone || "—") + "</td>" +
            "<td>" +
            '<div class="row-actions">' +
            '<button class="mini-btn" data-action="edit-client" data-id="' + c.id + '">Modifier</button>' +
            '<button class="mini-btn" data-action="print-client" data-id="' + c.id + '" title="Fiche client imprimable">Imprimer</button>' +
            '<button class="mini-btn danger" data-action="del-client" data-id="' + c.id + '">Supprimer</button>' +
            "</div></td></tr>";
        }).join("")
      : '<tr><td class="empty-note" colspan="5">Aucun client pour le moment.</td></tr>';

    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="admin-head"><div><h2>Clients</h2><p>Vos fiches clients.</p></div>' +
      '<button class="admin-btn" data-action="new-client">+ Nouveau client</button></div>' +
      '<div class="admin-card"><div class="admin-table-wrap">' +
      '<table class="admin-table"><thead><tr><th>Nom</th><th>Entreprise</th><th>E-mail</th><th>Téléphone</th><th>Actions</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div></div></div>";

    $$("[data-action=new-client]", adminMain).forEach(function (b) { b.addEventListener("click", clientForm); });
    $$("[data-action=edit-client]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { clientForm(b.getAttribute("data-id")); });
    });
    $$("[data-action=del-client]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { if (confirm("Supprimer ce client ?")) { setList(LS_CLIENTS, getList(LS_CLIENTS).filter(function (c) { return c.id !== b.getAttribute("data-id"); })); renderClients(); } });
    });
    $$("[data-action=print-client]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { printClient(b.getAttribute("data-id")); });
    });
  }

  function clientForm(id) {
    var existing = id ? findClient(id) : null;
    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="admin-head"><div><h2>' + (existing ? "Modifier le client" : "Nouveau client") + "</h2><p>Les champs sont facultatifs sauf le nom.</p></div></div>" +
      '<div class="admin-card"><form class="admin-form" id="form-client">' +
      '<div class="admin-form-grid">' +
      '<div class="form-field"><label>Nom complet *</label><input name="name" required value="' + esc(existing ? existing.name : "") + '"></div>' +
      '<div class="form-field"><label>Entreprise</label><input name="company" value="' + esc(existing ? existing.company : "") + '"></div>' +
      '<div class="form-field"><label>E-mail</label><input name="email" type="email" value="' + esc(existing ? existing.email : "") + '"></div>' +
      '<div class="form-field"><label>Téléphone</label><input name="phone" value="' + esc(existing ? existing.phone : "") + '"></div>' +
      '<div class="form-field full"><label>Adresse</label><input name="address" value="' + esc(existing ? existing.address : "") + '"></div>' +
      '<div class="form-field full"><label>Note</label><textarea name="notes" rows="3">' + esc(existing ? existing.notes : "") + "</textarea></div>" +
      "</div>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn">Enregistrer</button>' +
      '<button type="button" class="admin-btn admin-btn-ghost" data-action="back-clients">Retour</button>' +
      "</div></form></div></div>";
    $("#form-client").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var fields = {};
      ["name", "company", "email", "phone", "address", "notes"].forEach(function (k) {
        var inp = $('[name="' + k + '"]', f);
        fields[k] = inp ? inp.value.trim() : "";
      });
      if (!fields.name) return;
      var list = getList(LS_CLIENTS);
      if (existing) {
        for (var i = 0; i < list.length; i++) if (list[i].id === existing.id) list[i] = Object.assign({}, list[i], fields);
      } else {
        list.push(Object.assign({ id: uid(), created: new Date().toISOString() }, fields));
      }
      setList(LS_CLIENTS, list);
      renderClients();
    });
    $("[data-action=back-clients]").addEventListener("click", renderClients);
  }

  /* ---------- Documents (factures / devis) ---------- */
  function renderDocs(type, prefix) {
    return function () {
      var list = getList(type === "factures" ? LS_FACTURES : LS_DEVIS);
      var labels = type === "factures" ? { title: "Factures", new: "+ Nouvelle facture" } : { title: "Devis", new: "+ Nouveau devis" };
      var statusBadge = {
        brouillon: '<span class="badge badge-draft">Brouillon</span>',
        en_attente: '<span class="badge badge-pending">En attente</span>',
        payee: '<span class="badge badge-paid">Payée</span>',
        accepte: '<span class="badge badge-accepted">Accepté</span>',
        refuse: '<span class="badge badge-rejected">Refusé</span>',
        annulee: '<span class="badge badge-cancelled">Annulée</span>'
      };
      var rows = list.length
        ? list.map(function (d) {
            var cl = findClient(d.clientId);
            var tot = docTotals(d.lignes);
            return "<tr>" +
              '<td class="num-cell">' + esc(d.num) + "</td>" +
              "<td>" + esc(cl ? (cl.name || cl.company || "Sans nom") : "Client supprimé") + "</td>" +
              "<td>" + (type === "factures" ? fmtDate(d.echeance || d.date) : (d.validite ? "Valide " + fmtDate(d.validite) : "Ouvrir")) + "</td>" +
              '<td class="amount">' + fmtMoney(tot.ttc) + "</td>" +
              "<td>" + (statusBadge[d.statut] || "") + "</td>" +
              "<td>" +
              '<div class="row-actions">' +
              '<button class="mini-btn primary" data-action="print-doc" data-type="' + type + '" data-id="' + d.id + '">Imprimer</button>' +
              '<button class="mini-btn" data-action="edit-doc" data-type="' + type + '" data-id="' + d.id + '">Modifier</button>' +
              '<button class="mini-btn danger" data-action="del-doc" data-type="' + type + '" data-id="' + d.id + '">Supprimer</button>' +
              "</div></td></tr>";
          }).join("")
        : '<tr><td class="empty-note" colspan="6">Aucun document pour le moment.</td></tr>';

      adminMain.innerHTML =
        '<div class="admin-container">' +
        '<div class="admin-head"><div><h2>' + labels.title + "</h2><p>Créez, imprimez et suivez vos documents.</p></div>" +
        '<button class="admin-btn" data-action="new-doc" data-type="' + type + '">' + labels.new + "</button></div>" +
        '<div class="admin-card"><div class="admin-table-wrap">' +
        '<table class="admin-table"><thead><tr><th>N°</th><th>Client</th><th>' + (type === "factures" ? "Échéance" : "Validité") + "</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div></div></div>";

      $$("[data-action=new-doc]", adminMain).forEach(function (b) {
        b.addEventListener("click", function () { docForm(b.getAttribute("data-type"), null); });
      });
      $$("[data-action=edit-doc]", adminMain).forEach(function (b) {
        b.addEventListener("click", function () { docForm(b.getAttribute("data-type"), b.getAttribute("data-id")); });
      });
      $$("[data-action=print-doc]", adminMain).forEach(function (b) {
        b.addEventListener("click", function () { printDoc(b.getAttribute("data-type"), b.getAttribute("data-id")); });
      });
      $$("[data-action=del-doc]", adminMain).forEach(function (b) {
        b.addEventListener("click", function () {
          var t = b.getAttribute("data-type"), id = b.getAttribute("data-id");
          if (confirm("Supprimer ce document ?")) {
            setList(type === "factures" ? LS_FACTURES : LS_DEVIS, getList(type === "factures" ? LS_FACTURES : LS_DEVIS).filter(function (d) { return d.id !== id; }));
            renderActive();
          }
        });
      });
    };
  }

  function lineRowHTML(l) {
    return "<tr>" +
      '<td><input name="l-des" value="' + esc(l.des || "") + '" placeholder="Désignation"></td>' +
      '<td><input class="num-in" name="l-qte" type="number" step="0.01" min="0" value="' + esc(l.qte != null ? l.qte : "") + '"></td>' +
      '<td><input class="num-in" name="l-pu" type="number" step="0.01" min="0" value="' + esc(l.pu != null ? l.pu : "") + '"></td>' +
      '<td><input class="num-in" name="l-tva" type="number" step="0.1" min="0" max="100" value="' + esc(l.tva != null ? l.tva : "") + '"></td>' +
      '<td class="line-total">' + (l.qte && l.pu ? fmtMoney(lineTotal(l)) : "—") + "</td>" +
      '<td><button type="button" class="mini-btn danger" data-action="rm-line">✕</button></td>' +
      "</tr>";
  }

  function linesToHTML(lines) {
    var rows = (lines && lines.length ? lines : [{ qte: "", pu: "", tva: "", des: "" }]).map(lineRowHTML).join("");
    return '<table class="lines-table"><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA %</th><th>Total</th><th></th></tr></thead><tbody id="lines-tbody">' + rows + "</tbody></table>";
  }

  function docForm(type, id) {
    var key = type === "factures" ? LS_FACTURES : LS_DEVIS;
    var list = getList(key);
    var existing = id ? (list.filter(function (d) { return d.id === id; })[0] || null) : null;
    var clients = getList(LS_CLIENTS);

    if (!clients.length) {
      renderDocs(type === "factures" ? "factures" : "devis", type === "factures" ? "FA" : "DE")();
      adminMain.insertAdjacentHTML("afterbegin",
        '<div class="admin-container"><div class="admin-card" style="border-color:#f0c36d;background:#fffbf0;">' +
        '<p><strong>Astuce :</strong> créez d\'abord un client pour associer les documents.</p></div></div>');
      return;
    }

    var isFacture = type === "factures";
    var title = existing ? (isFacture ? "Modifier la facture " + existing.num : "Modifier le devis " + existing.num) : (isFacture ? "Nouvelle facture" : "Nouveau devis");
    var clientOptions = clients.map(function (c) {
      return '<option value="' + c.id + '"' + (existing && existing.clientId === c.id ? " selected" : "") + ">" + esc(c.name + (c.company ? " (" + c.company + ")" : "")) + "</option>";
    }).join("");

    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="admin-head"><div><h2>' + title + "</h2></div></div>" +
      '<div class="admin-card"><form class="admin-form" id="form-doc">' +
      '<div class="admin-form-grid">' +
      '<div class="form-field"><label>Client *</label><select name="clientId" required>' + clientOptions + "</select></div>" +
      '<div class="form-field"><label>Date</label><input name="date" type="date" value="' + (existing ? existing.date : today()) + '"></div>' +
      '<div class="form-field"><label>' + (isFacture ? "Échéance" : "Valide jusqu'au") + '</label><input name="echeance" type="date" value="' + esc(existing ? existing.echeance : "") + '"></div>' +
      '<div class="form-field"><label>Statut</label><select name="statut">' +
      '<option value="brouillon"' + ((!existing || existing.statut === "brouillon") ? " selected" : "") + ">Brouillon</option>" +
      '<option value="en_attente"' + (existing && existing.statut === "en_attente" ? " selected" : "") + ">" + (isFacture ? "Émise" : "En attente") + "</option>" +
      '<option value="' + (isFacture ? "payee" : "accepte") + '"' + (existing && (existing.statut === "payee" || existing.statut === "accepte") ? " selected" : "") + ">" + (isFacture ? "Payée" : "Accepté") + "</option>" +
      '<option value="' + (isFacture ? "annulee" : "refuse") + '"' + (existing && (existing.statut === "annulee" || existing.statut === "refuse") ? " selected" : "") + ">" + (isFacture ? "Annulée" : "Refusé") + "</option>" +
      "</select></div>" +
      "</div>" +
      '<div class="form-field"><label>Lignes</label>' + linesToHTML(existing ? existing.lignes : null) +
      '<button type="button" class="mini-btn" data-action="add-line" style="margin-top:8px;">+ Ajouter une ligne</button></div>' +
      '<div class="form-field"><label>Note</label><textarea name="notes" rows="2">' + esc(existing ? existing.notes : "") + "</textarea></div>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn">Enregistrer</button>' +
      '<button type="button" class="admin-btn admin-btn-ghost" data-action="back-docs">Retour</button>' +
      "</div></form></div></div>";

    $("#form-doc").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var clientId = $('[name=clientId]', f).value;
      var date = $('[name=date]', f).value;
      var echeance = $('[name=echeance]', f).value;
      var statut = $('[name=statut]', f).value;
      var notes = $('[name=notes]', f).value.trim();
      if (!clientId) return;
      var lines = [];
      var rows = $$("#lines-tbody tr", f);
      rows.forEach(function (r) {
        var des = $('[name=l-des]', r).value.trim();
        var qte = $('[name=l-qte]', r).value;
        var pu = $('[name=l-pu]', r).value;
        var tva = $('[name=l-tva]', r).value;
        if (!des && !qte && !pu) return;
        lines.push({ des: des, qte: parseFloat(qte) || 0, pu: parseFloat(pu) || 0, tva: parseFloat(tva) || 0 });
      });
      if (!lines.length) return;
      if (existing) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === existing.id) {
            list[i] = Object.assign({}, list[i], { clientId: clientId, date: date, echeance: echeance, statut: statut, lignes: lines, notes: notes });
          }
        }
      } else {
        list.push({ id: uid(), num: nextNum(type, isFacture ? "FA" : "DE"), clientId: clientId, date: date, echeance: echeance, statut: statut, lignes: lines, notes: notes, created: new Date().toISOString() });
      }
      setList(key, list);
      renderActive();
    });

    $("[data-action=back-docs]").addEventListener("click", renderActive);
    $("[data-action=add-line]").addEventListener("click", function () {
      $("#lines-tbody").insertAdjacentHTML("beforeend", lineRowHTML({ des: "", qte: "", pu: "", tva: "" }));
      $$("#lines-tbody [data-action=rm-line]", adminMain).forEach(function (b) {
        b.addEventListener("click", function () { var tr = b.closest("tr"); if (tr) tr.remove(); });
      });
    });
    $$("#lines-tbody [data-action=rm-line]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { var tr = b.closest("tr"); if (tr) tr.remove(); });
    });
  }

  /* ---------- Contrats ---------- */
  function renderContrats() {
    var list = getList(LS_CONTRATS);
    var badge = { actif: '<span class="badge badge-active">Actif</span>', termine: '<span class="badge badge-over">Terminé</span>', en_attente: '<span class="badge badge-pending">En attente</span>' };
    var rows = list.length
      ? list.map(function (c) {
          var cl = findClient(c.clientId);
          return "<tr>" +
            '<td class="num-cell">' + esc(c.num) + "</td>" +
            "<td>" + esc(c.titre || "—") + "</td>" +
            "<td>" + esc(cl ? (cl.name || cl.company || "Sans nom") : "Client supprimé") + "</td>" +
            '<td class="amount">' + fmtMoney(c.montant) + "</td>" +
            "<td>" + (badge[c.statut] || "") + "</td>" +
            "<td>" +
            '<div class="row-actions">' +
            '<button class="mini-btn primary" data-action="print-contrat" data-id="' + c.id + '">Imprimer</button>' +
            '<button class="mini-btn" data-action="edit-contrat" data-id="' + c.id + '">Modifier</button>' +
            '<button class="mini-btn danger" data-action="del-contrat" data-id="' + c.id + '">Supprimer</button>' +
            "</div></td></tr>";
        }).join("")
      : '<tr><td class="empty-note" colspan="6">Aucun contrat pour le moment.</td></tr>';

    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="admin-head"><div><h2>Contrats</h2><p>Créez et imprimez vos contrats clients.</p></div>' +
      '<button class="admin-btn" data-action="new-contrat">+ Nouveau contrat</button></div>' +
      '<div class="admin-card"><div class="admin-table-wrap">' +
      '<table class="admin-table"><thead><tr><th>N°</th><th>Titre</th><th>Client</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div></div></div>";

    $$("[data-action=new-contrat]", adminMain).forEach(function (b) { b.addEventListener("click", function () { contratForm(); }); });
    $$("[data-action=edit-contrat]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { contratForm(b.getAttribute("data-id")); });
    });
    $$("[data-action=print-contrat]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () { printContrat(b.getAttribute("data-id")); });
    });
    $$("[data-action=del-contrat]", adminMain).forEach(function (b) {
      b.addEventListener("click", function () {
        if (confirm("Supprimer ce contrat ?")) {
          setList(LS_CONTRATS, getList(LS_CONTRATS).filter(function (c) { return c.id !== b.getAttribute("data-id"); }));
          renderActive();
        }
      });
    });
  }

  function contratForm(id) {
    var list = getList(LS_CONTRATS);
    var existing = id ? (list.filter(function (c) { return c.id === id; })[0] || null) : null;
    var clients = getList(LS_CLIENTS);
    if (!clients.length) {
      renderContrats();
      adminMain.insertAdjacentHTML("afterbegin",
        '<div class="admin-container"><div class="admin-card" style="border-color:#f0c36d;background:#fffbf0;">' +
        '<p><strong>Astuce :</strong> créez d\'abord un client pour associer le contrat.</p></div></div>');
      return;
    }
    var clientOptions = clients.map(function (c) {
      return '<option value="' + c.id + '"' + (existing && existing.clientId === c.id ? " selected" : "") + ">" + esc(c.name + (c.company ? " (" + c.company + ")" : "")) + "</option>";
    }).join("");

    adminMain.innerHTML =
      '<div class="admin-container">' +
      '<div class="admin-head"><div><h2>' + (existing ? "Modifier le contrat " + existing.num : "Nouveau contrat") + "</h2></div></div>" +
      '<div class="admin-card"><form class="admin-form" id="form-contrat">' +
      '<div class="admin-form-grid">' +
      '<div class="form-field full"><label>Titre du contrat *</label><input name="titre" required value="' + esc(existing ? existing.titre : "") + '"></div>' +
      '<div class="form-field"><label>Client *</label><select name="clientId" required>' + clientOptions + "</select></div>" +
      '<div class="form-field"><label>Date</label><input name="date" type="date" value="' + (existing ? existing.date : today()) + '"></div>' +
      '<div class="form-field"><label>Montant (€)</label><input name="montant" type="number" step="0.01" min="0" value="' + (existing ? existing.montant : "") + '"></div>' +
      '<div class="form-field"><label>Durée</label><input name="duree" value="' + esc(existing ? existing.duree : "") + '" placeholder="Ex : 12 mois"></div>' +
      '<div class="form-field"><label>Statut</label><select name="statut">' +
      '<option value="en_attente"' + (!existing || existing.statut === "en_attente" ? " selected" : "") + ">En attente</option>" +
      '<option value="actif"' + (existing && existing.statut === "actif" ? " selected" : "") + ">Actif</option>" +
      '<option value="termine"' + (existing && existing.statut === "termine" ? " selected" : "") + ">Terminé</option>" +
      "</select></div>" +
      '<div class="form-field full"><label>Objet / cadre du service</label><textarea name="objet" rows="2">' + esc(existing ? existing.objet : "") + "</textarea></div>" +
      '<div class="form-field full"><label>Clauses et conditions</label><textarea name="clauses" rows="5">' + esc(existing ? existing.clauses : "") + "</textarea></div>" +
      "</div>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn">Enregistrer</button>' +
      '<button type="button" class="admin-btn admin-btn-ghost" data-action="back-contrats">Retour</button>' +
      "</div></form></div></div>";

    $("#form-contrat").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var data = {};
      ["titre", "clientId", "date", "montant", "duree", "statut", "objet", "clauses"].forEach(function (k) {
        var inp = $('[name="' + k + '"]', f);
        data[k] = inp ? inp.value.trim() : "";
      });
      if (!data.titre || !data.clientId) return;
      if (existing) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === existing.id) list[i] = Object.assign({}, list[i], data);
        }
      } else {
        list.push(Object.assign({ id: uid(), num: nextNum("contrats", "CT") }, data, { montant: parseFloat(data.montant) || 0, created: new Date().toISOString() }));
      }
      setList(LS_CONTRATS, list);
      renderActive();
    });
    $("[data-action=back-contrats]").addEventListener("click", renderActive);
  }

  /* ============================================================
     ESPACE DE TRAVAIL
     ============================================================ */
  function renderWorkspace() {
    if (window.GestWorkspace && typeof window.GestWorkspace.render === "function") {
      window.GestWorkspace.render();
    } else {
      adminMain.innerHTML =
        '<div class="admin-container"><div class="admin-card"><p>Le module Espace de travail n’est pas chargé.</p></div></div>';
    }
  }

  /* ============================================================
     IMPRESSION
     ============================================================ */
  var printSheet = $("#print-sheet");

  function sheetBase() {
    return "" +
      '<div class="ps-head">' +
      '<div class="ps-brand">' +
      '<span class="ps-logo">' + LOGO_SVG + "</span>" +
      '<div><div class="ps-brand-name">GestAffaires</div>' +
      '<div class="ps-brand-sub">GESTION · ADMINISTRATION · DIGITAL</div></div>' +
      "</div>" +
      '<div class="ps-title">__TITLE__<div class="ps-num">__NUM__</div><div class="ps-meta">__META__</div></div>' +
      "</div>";
  }
  function clientBlock(c) {
    var name = c ? esc(c.name || "") : "—";
    var lines = [name];
    if (c && c.company) lines.push(esc(c.company));
    if (c && c.address) lines.push(esc(c.address));
    return "<div class='ps-block'><h3>Client</h3><p>" + lines.join("\n") + "</p><p>" +
      (c && c.email ? esc(c.email) : "") + (c && c.phone ? "<br>" + esc(c.phone) : "") + "</p></div>";
  }
  function sheetCompany() {
    return "<div class='ps-block'><h3>Émetteur</h3><p><b>GestAffaires – Gestion &amp; Digital</b>\nContact : 06 12 34 56 78\ngestaffaires45@gmail.com</p></div>";
  }
  function docTable(lines) {
    var rows = lines.map(function (l) {
      return "<tr><td>" + esc(l.des || "—") + "</td><td class='right'>" + (Number(l.qte) || 0) + "</td><td class='right'>" + fmtMoney(l.pu) + "</td><td class='right'>" + (Number(l.tva) || 0) + " %</td><td class='right'>" + fmtMoney(lineTotal(l)) + "</td></tr>";
    }).join("");
    return "<table><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }
  function totalsBlock(tot, statutLabel) {
    return '<div class="ps-totals">' +
      "<div><span>Total HT</span><span>" + fmtMoney(tot.ht) + "</span></div>" +
      "<div><span>Total TVA</span><span>" + fmtMoney(tot.tva) + "</span></div>" +
      '<div class="grand"><span>Total TTC</span><span>' + fmtMoney(tot.ttc) + "</span></div>" +
      '<div style="margin-top:10px;"><span class="ps-status">' + statutLabel + "</span></div></div>";
  }
  function sheetFoot() {
    return '<div class="ps-sig"><div>Le prestataire / L\'administrateur</div><div>Le client</div></div>' +
      '<div class="ps-foot"><b>GestAffaires – Gestion &amp; Digital</b> · 06 12 34 56 78 · gestaffaires45@gmail.com</div>';
  }

  function printHTML(htmlAction) {
    printSheet.innerHTML = "";
    printSheet.setAttribute("aria-hidden", "true");
    document.body.classList.add("printing");
    printSheet.innerHTML = htmlAction();
    printSheet.setAttribute("aria-hidden", "false");
    window.print();
  }

  function printDoc(type, id) {
    var key = type === "factures" ? LS_FACTURES : LS_DEVIS;
    var list = getList(key);
    var doc = list.filter(function (d) { return d.id === id; })[0];
    if (!doc) return;
    var cl = findClient(doc.clientId);
    var tot = docTotals(doc.lignes);
    var isF = type === "factures";
    var statutLabel = { brouillon: "Brouillon", en_attente: isF ? "Émise" : "En attente", payee: "Payée", accepte: "Accepté", refuse: "Refusé", annulee: "Annulée" }[doc.statut] || "—";
    var meta = "Date : " + fmtDate(doc.date) + (doc.echeance ? " · " + (isF ? "Échéance" : "Valide jusqu'au") + " : " + fmtDate(doc.echeance) : "");

    printHTML(function () {
      return '<div class="ps-doc">' +
        sheetBase().replace("__TITLE__", "<h1>" + (isF ? "Facture" : "Devis") + "</h1>").replace("__NUM__", esc(doc.num)).replace("__META__", meta) +
        '<div class="ps-body">' + sheetCompany() + clientBlock(cl) +
        (doc.notes ? "<div class='ps-clauses'>Note : " + esc(doc.notes) + "</div>" : "") +
        "</div>" +
        docTable(doc.lignes) +
        totalsBlock(tot, statutLabel) +
        sheetFoot() +
        "</div>";
    });
  }

  function printClient(id) {
    var cl = findClient(id);
    if (!cl) return;
    var factures = getList(LS_FACTURES).filter(function (f) { return f.clientId === id; });
    var fRows = factures.length ? factures.map(function (f) {
      return "<tr><td>" + esc(f.num) + "</td><td>" + fmtDate(f.date) + "</td><td class='right'>" + fmtMoney(docTotals(f.lignes).ttc) + "</td></tr>";
    }).join("") : '<tr><td colspan="3">Aucune facture.</td></tr>';

    printHTML(function () {
      return '<div class="ps-doc">' +
        sheetBase().replace("__TITLE__", "<h1>Fiche client</h1>").replace("__NUM__", "").replace("__META__", "Créé le " + fmtDate((cl.created || "").slice(0, 10))) +
        '<div class="ps-body">' + sheetCompany() + clientBlock(cl) + "</div>" +
        "<h3 style='text-transform:uppercase;font-size:12px;letter-spacing:.12em;color:#1b3358;'>Historique des factures</h3>" +
        "<table><thead><tr><th>N°</th><th>Date</th><th>Total TTC</th></tr></thead><tbody>" + fRows + "</tbody></table>" +
        sheetFoot() + "</div>";
    });
  }

  function printContrat(id) {
    var list = getList(LS_CONTRATS);
    var c = list.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var cl = findClient(c.clientId);
    var statutLabel = { en_attente: "En attente", actif: "Actif", termine: "Terminé" }[c.statut] || "—";

    printHTML(function () {
      return '<div class="ps-doc">' +
        sheetBase().replace("__TITLE__", "<h1>Contrat</h1>").replace("__NUM__", esc(c.num)).replace("__META__", "Date : " + fmtDate(c.date)) +
        '<div class="ps-body">' + sheetCompany() + clientBlock(cl) + "</div>" +
        '<div class="ps-clauses"><b>Objet :</b> ' + esc(c.objet || "") + "\n\n" + esc(c.clauses || "") + "</div>" +
        '<div class="ps-totals" style="margin-left:0;">' +
        "<div><span>Durée</span><span>" + esc(c.duree || "—") + "</span></div>" +
        "<div><span>Montant</span><span>" + fmtMoney(c.montant) + "</span></div>" +
        '<div class="grand"><span>Statut</span><span class="ps-status">' + statutLabel + "</span></div></div>" +
        sheetFoot() + "</div>";
    });
  }

  /* ============================================================
     BINDINGS
     ============================================================ */
  var authTrigger = $("#auth-trigger");
  if (authTrigger) {
    authTrigger.addEventListener("click", function (e) {
      e.preventDefault();
      if (currentUser()) { openPanel(); } else { openModal(modalLogin); }
    });
  }

  var formLogin = $("#form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", function (e) {
      e.preventDefault();
      showErr(authErrorLogin, null);
      var l = $("#login-login").value;
      var p = $("#login-pass").value;
      if (!l || !p) { showErr(authErrorLogin, "Veuillez saisir votre identifiant et votre mot de passe."); return; }
      loginUser(l, p);
    });
  }

  var formRegister = $("#form-register");
  if (formRegister) {
    formRegister.addEventListener("submit", function (e) {
      e.preventDefault();
      showErr(authErrorRegister, null);
      var name = $("#reg-name").value;
      var login = $("#reg-login").value;
      var email = $("#reg-email").value;
      var pass = $("#reg-pass").value;
      var code = $("#reg-code").value;
      registerUser(name, login, email, pass, code);
    });
  }

  var switchRegister = $("#switch-register");
  if (switchRegister) switchRegister.addEventListener("click", function (e) { e.preventDefault(); openModal(modalRegister); });
  var switchLogin = $("#switch-login");
  if (switchLogin) switchLogin.addEventListener("click", function (e) { e.preventDefault(); openModal(modalLogin); });

  var btnLogout = $("#admin-logout");
  if (btnLogout) btnLogout.addEventListener("click", logout);
  var btnClose = $("#admin-close");
  if (btnClose) btnClose.addEventListener("click", closePanel);

  document.addEventListener("click", function (e) {
    /* Ne pas fermer si le clic visait un élément du panneau qui vient
       d'être re-rendu (retiré du DOM pendant la propagation du clic),
       ni le bouton qui ouvre le panneau (sinon ouverture + fermeture). */
    var target = e.target;
    if (panel && !panel.hidden && target && document.contains(target) && !panel.contains(target)) {
      if (authTrigger && (target === authTrigger || (target.closest && target.closest("#auth-trigger")))) return;
      closePanel();
    }
  });

  refreshAuthUI();
})();