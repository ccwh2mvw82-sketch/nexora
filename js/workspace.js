/* ============================================================
   GestAffaires – Espace de travail (ADMIN uniquement)
   Vrai mini-logiciel de travail par client :
   range, automatise, suit et exporte (Excel/CSV/PDF).
   Réservé à l'administrateur (rôle admin, code GEST-2026).
   Modules apportés par workspace-g.js et workspace-c.js,
   enregistrés via GestWorkspace.register().
   ============================================================ */

window.GestWorkspace = (function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var LS_WS = "ga_ws";
  var LS_CLIENTS = "ga_clients";
  var LS_FACTURES = "ga_factures";
  var LS_DEVIS = "ga_devis";
  var LS_CONTRATS = "ga_contrats";
  var LS_USERS = "ga_users";
  var LS_SESSION = "ga_session";

  var adminMain = function () { return $("#admin-main"); };
  var modules = [];
  var state = { clientId: null };
  var active = null;

  /* ------------------------------------------------------------------
     OUTILS DE BASE
     ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"\u0027]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\u0027": "&#39;" }[c];
    });
  }
  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }
  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var p = String(iso).split("T")[0].split("-");
      return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso);
    } catch (e) { return String(iso); }
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function uid() {
    return "id" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }
  function load(key, def) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function get(key) { return load(key, []); }
  function put(key, list) { save(key, list); }

  function getClients() { return get(LS_CLIENTS); }
  function findClient(id) {
    var found = getClients().filter(function (c) { return c.id === id; })[0];
    return found || null;
  }
  function clientLabel(c) { return c ? (c.name || c.company || "Sans nom") : "(client supprimé)"; }

  function isAdmin() {
    var session = load(LS_SESSION, null);
    var users = load(LS_USERS, []);
    if (!session) return false;
    var sid = typeof session === "object" && session ? session.id : session;
    var u = users.filter(function (x) { return x.id === sid; })[0];
    return !!(u && u.role === "admin");
  }

  function getDocs(key) { return get(key); }
  function docTotals(lines) {
    var ht = 0, tva = 0;
    (lines || []).forEach(function (l) {
      var t = (Number(l.qte) || 0) * (Number(l.pu) || 0);
      ht += t;
      tva += t * (Number(l.tva) || 0) / 100;
    });
    return { ht: ht, tva: tva, ttc: ht + tva };
  }

  /* ------------------------------------------------------------------
     ÉTAT / MÉMOIRE (client actif, module actif)
     ------------------------------------------------------------------ */
  function persistState() {
    var out = { clientId: state.clientId, active: active };
    save(LS_WS, out);
  }
  function restoreState() {
    var p = load(LS_WS, null);
    if (p) {
      if (p.clientId) state.clientId = p.clientId;
      if (p.active) active = p.active;
    }
  }
  function setClient(id) {
    state.clientId = id;
    persistState();
  }
  function currentClientId() { return state.clientId; }
  function selectedClient() { return state.clientId ? findClient(state.clientId) : null; }

  function openModule(id) {
    active = id;
    persistState();
    if (typeof window.scrollTo === "function") {
      try { window.scrollTo(0, 0); } catch (e) {}
    }
    render();
  }
  function goHome() {
    active = null;
    persistState();
    render();
  }

  /* ------------------------------------------------------------------
     EXPORTS : CSV, EXCEL (.xls), IMPRIMER/PDF, COPIER
     ------------------------------------------------------------------ */
  function downloadFile(name, mime, content) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 400);
  }
  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[";\n]/.test(s)) s = "\"" + s.replace(/"/g, "\"\"") + "\"";
    return s;
  }
  function exportCSV(filename, rows) {
    var head = (rows.head || []).map(csvEscape).join(";");
    var body = (rows.body || []).map(function (r) { return r.map(csvEscape).join(";"); }).join("\n");
    downloadFile(filename, "text/csv;charset=utf-8", "\ufeff" + head + "\n" + body);
  }
  function exportExcel(filename, rows) {
    var table =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='utf-8'><style>td,th{border:1px solid #ccc;mso-number-format:'\\@';}</style></head><body>" +
      "<table><thead><tr>" + rows.head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead>" +
      "<tbody>" + rows.body.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(String(c == null ? "" : c)).replace(/\n/g, "<br>") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></body></html>";
    var blob = new Blob(["\ufeff" + table], { type: "application/vnd.ms-excel;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 400);
  }
  function copyText(txt) {
    var ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    toast("Texte copié dans le presse-papiers");
  }
  function printHTML(title, body) {
    var sheet = $("#print-sheet");
    if (!sheet) return;
    sheet.innerHTML = "";
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.add("printing");
    var logoBlock = "";
    var brand = "";
    sheet.innerHTML = "<div class='ps-doc'>" + brand +
      "<h2 style='text-transform:uppercase;letter-spacing:.1em;font-size:13px;color:#1b3358;margin:0 0 4px;'>" + esc(title) + "</h2>" +
      "<hr style='border:none;border-top:2px solid #0CB5A6;margin:0 0 12px;'>" + body + "</div>";
    sheet.setAttribute("aria-hidden", "false");
    try { window.print(); } catch (e) {}
    setTimeout(function () { document.body.classList.remove("printing"); sheet.setAttribute("aria-hidden", "true"); sheet.innerHTML = ""; }, 600);
  }
  function toast(msg) {
    var box = $("#ws-toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "ws-toast";
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add("show");
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.classList.remove("show"); }, 2200);
  }

  /* ------------------------------------------------------------------
     COMPOSANTS UI COMMUNS
     ------------------------------------------------------------------ */
  function badge(text, kind) {
    return "<span class='ws-pill ws-pill-" + (kind || "grey") + "'>" + esc(text) + "</span>";
  }
  function kpi(label, value, sub, kind) {
    return "<div class='ws-kpi'><div class='ws-kpi-v'>" + value + "</div><div class='ws-kpi-l'>" + esc(label) + "</div>" + (sub ? "<div class='ws-kpi-s'>" + sub + "</div>" : "") + "</div>";
  }
  function clientBar() {
    var clients = getClients();
    var opts = ['<option value="">— Aucun client —</option>'].concat(clients.map(function (c) {
      return '<option value="' + c.id + '"' + (state.clientId === c.id ? " selected" : "") + ">" + esc(clientLabel(c)) + "</option>";
    })).join("");
    return "<div class='ws-clientbar'>" +
      "<label>Client actif</label>" +
      "<select id='ws-client-select'>" + opts + "</select>" +
      "<span class='ws-clientbar-hint'>" + (selectedClient() ? esc(clientLabel(selectedClient())) : "Vue globale — chaque module filtre sur ce client") + "</span>" +
      "</div>";
  }
  function toolbar(btns) {
    if (!btns || !btns.length) return "";
    return "<div class='ws-toolbar'>" + btns.map(function (b) {
      return "<button type='button' class='ws-tbtn' data-tb='" + b.action + "'>" + b.label + "</button>";
    }).join("") + "</div>";
  }
  function bindToolbar(btns) {
    $$("[data-tb]", adminMain()).forEach(function (b) {
      var act = b.getAttribute("data-tb");
      var cfg = btns.filter(function (x) { return x.action === act; })[0];
      if (cfg && cfg.fn) b.addEventListener("click", cfg.fn);
    });
  }
  function empty(msg) {
    return "<p class='ws-empty'>" + esc(msg) + "</p>";
  }
  function tableHTML(head, rows, emptyMsg) {
    if (!rows.length) return empty(emptyMsg || "Aucune donnée pour le moment.");
    return "<div class='ws-table-wrap'><table class='ws-table'><thead><tr>" + head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function formRow(label, html) {
    return "<div class='ws-frow'><label>" + esc(label) + "</label>" + html + "</div>";
  }
  function input(n, val, ph, extra) {
    return "<input name='" + n + "' value='" + esc(val || "") + "' placeholder='" + esc(ph || "") + "' " + (extra || "") + ">";
  }
  function textarea(n, val, ph, rows) {
    return "<textarea name='" + n + "' rows='" + (rows || 3) + "' placeholder='" + esc(ph || "") + "'>" + esc(val || "") + "</textarea>";
  }
  function select(n, options, val) {
    return "<select name='" + n + "'>" + options.map(function (o) {
      var v = typeof o === "object" ? o.v : o;
      var l = typeof o === "object" ? o.l : o;
      return "<option value='" + v + "'" + (String(val) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";
    }).join("") + "</select>";
  }
  function money(n) {
    return "<input name='" + n + "' type='number' step='0.01' min='0' class='ws-num' value='" + esc(n || "") + "'>";
  }
  function monRight(n) {
    return "<span class='ws-num-r'>" + fmtMoney(n) + "</span>";
  }

  /* ------------------------------------------------------------------
     NAVIGATION des modules
     ------------------------------------------------------------------ */
  function categoryOf(m) { return m.cat || "Gestion"; }
  function moduleNavHTML() {
    var cats = [];
    modules.forEach(function (m) {
      var c = categoryOf(m);
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    return cats.map(function (c) {
      var items = modules.filter(function (m) { return categoryOf(m) === c; }).map(function (m) {
        return "<a href='#' class='ws-mod-nav' data-open='" + m.id + "'><span class='ws-mod-ico'>" + m.icon + "</span><span><b>" + esc(m.name) + "</b><small>" + esc(m.tag || "") + "</small></span></a>";
      }).join("");
      return "<div class='ws-cat'><h4>" + esc(c) + "</h4><div class='ws-mod-grid'>" + items + "</div></div>";
    }).join("");
  }

  /* ------------------------------------------------------------------
     SYNTHÈSE (accueil) : indicateurs selon le client sélectionné
     ------------------------------------------------------------------ */
  function synthFor(clientId) {
    var F = get(LS_FACTURES), D = get(LS_DEVIS), C = get(LS_CONTRATS);
    var f = clientId ? F.filter(function (x) { return x.clientId === clientId; }) : F;
    var d = clientId ? D.filter(function (x) { return x.clientId === clientId; }) : D;
    var c = clientId ? C.filter(function (x) { return x.clientId === clientId; }) : C;
    var total = f.reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var payees = f.filter(function (x) { return x.statut === "payee"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var impayees = f.filter(function (x) { return x.statut === "en_attente" || x.statut === "brouillon"; }).reduce(function (s, x) { return s + docTotals(x.lignes).ttc; }, 0);
    var devisEnCours = d.filter(function (x) { return x.statut === "en_attente" || x.statut === "accepte"; }).length;
    var contratsActifs = c.filter(function (x) { return x.statut === "actif"; }).length;
    var relances = get("ga_relances").filter(function (r) { return !clientId || r.clientId === clientId; });
    var echs = get("ga_echeances").filter(function (e) { return !clientId || e.clientId === clientId; });
    var echsAVenir = echs.filter(function (e) { return e.statut !== "fait" && e.date >= today(); }).length;
    var appels = get("ga_appels").filter(function (a) { return !clientId || a.clientId === clientId; }).filter(function (a) { return a.statut === "nouveau"; }).length;
    return { total: total, payees: payees, impayees: impayees, devisEnCours: devisEnCours, contratsActifs: contratsActifs, relances: relances.length, echsAVenir: echsAVenir, appels: appels };
  }
  function homeHTML() {
    var s = synthFor(state.clientId);
    var client = selectedClient();
    return "<div class='ws-app'>" +
      clientBar() +
      "<div class='ws-kpis'>" +
      kpi("Facturé", fmtMoney(s.total), "total factures") +
      kpi("Encaissé", fmtMoney(s.payees), "payées") +
      kpi("À encaisser", fmtMoney(s.impayees), "en attente / impayées", "warn") +
      kpi("Devis en cours", s.devisEnCours, "à suivre") +
      kpi("Contrats actifs", s.contratsActifs, "en cours") +
      kpi("Relances", s.relances, "historique") +
      kpi("Échéances à venir", s.echsAVenir, "déclarations") +
      kpi("Appels à traiter", s.appels, "secrétariat", "warn") +
      "</div>" +
      "<div class='ws-accueil'><h3>" + (client ? "Espace de travail · " + esc(clientLabel(client)) : "Espace de travail") + "</h3>" +
      "<p class='ws-sub'>Un vrai outil de travail, réservé à l'administrateur. Choisissez un module pour ouvrir la console correspondante : saisie, suivi, statuts, historique et exports Excel/PDF.</p></div>" +
      moduleNavHTML() +
      "</div>";
  }

  /* ------------------------------------------------------------------
     RENDU PRINCIPAL
     ------------------------------------------------------------------ */
  function render() {
    var main = adminMain();
    if (!main) return;
    if (!isAdmin()) {
      main.innerHTML = "<div class='admin-container'><div class='admin-card'><p><b>Espace réservé à l'administrateur.</b><br>Compte connecté : membre. Connectez-vous avec un compte admin (code GEST-2026).</p></div></div>";
      return;
    }
    var mod = active ? modules.filter(function (m) { return m.id === active; })[0] : null;
    if (mod) {
      renderModulePage(mod);
    } else {
      main.innerHTML = homeHTML();
      bindHome();
    }
  }

  function moduleHead(mod) {
    return "<div class='ws-modhead'>" +
      "<button class='ws-tbtn' data-ws-home>← Espace de travail</button>" +
      "<span class='ws-modhead-t'>" + mod.icon + " " + esc(mod.name) + "</span>" +
      "<span class='ws-modhead-s'>" + esc(mod.tag || "") + "</span>" +
      "</div>";
  }

  function moduleSwitcherHTML(cur) {
    return "<nav class='ws-modwrap'>" + modules.map(function (m) {
      return "<a href='#' class='ws-mod-nav" + (m.id === cur ? " active" : "") + "' data-open='" + m.id + "' title='" + esc(m.name) + "'><span class='ws-mod-ico'>" + m.icon + "</span><span class='ws-mod-sw'>" + esc(m.name) + "</span></a>";
    }).join("") + "</nav>";
  }

  function renderModulePage(mod) {
    var main = adminMain();
    var content = "";
    try {
      content = mod.render();
    } catch (e) {
      content = "<div class='admin-card'><p>Erreur du module " + esc(mod.id) + " : " + esc(e.message) + "</p></div>";
    }
    main.innerHTML = "<div class='ws-app'>" + moduleSwitcherHTML(mod.id) + moduleHead(mod) + clientBar() + "<div class='ws-mod-body'>" + content + "</div></div>";
    var home = $("[data-ws-home]", main);
    if (home) home.addEventListener("click", function (e) { e.preventDefault(); goHome(); });
    var sel = $("#ws-client-select", main);
    if (sel) sel.addEventListener("change", function () { setClient(sel.value); render(); });
    $$("[data-open]", main).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); openModule(a.getAttribute("data-open")); });
    });
    if (mod.afterRender) mod.afterRender();
  }

  function bindHome() {
    var main = adminMain();
    var sel = $("#ws-client-select", main);
    if (sel) sel.addEventListener("change", function () { setClient(sel.value); render(); });
    $$("[data-open]", main).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); openModule(a.getAttribute("data-open")); });
    });
  }

  /* ------------------------------------------------------------------
     REGISTRE + API PUBLIQUE
     ------------------------------------------------------------------ */
  function register(m) {
    modules.push(m);
    return m;
  }

  return {
    render: render,
    register: register,
    restoreState: restoreState,
    openModule: openModule,
    goHome: goHome,
    setClient: setClient,
    currentClientId: currentClientId,
    selectedClient: selectedClient,
    isAdmin: isAdmin,
    modules: modules,
    /* helpers publics */
    esc: esc, fmtMoney: fmtMoney, fmtDate: fmtDate, today: today, uid: uid,
    load: load, save: save, get: get, put: put,
    getClients: getClients, findClient: findClient, clientLabel: clientLabel,
    getDocs: getDocs, docTotals: docTotals,
    badge: badge, kpi: kpi, toolbar: toolbar, bindToolbar: bindToolbar,
    empty: empty, tableHTML: tableHTML, formRow: formRow,
    input: input, textarea: textarea, select: select, money: money, monRight: monRight,
    exportCSV: exportCSV, exportExcel: exportExcel, copyText: copyText, printHTML: printHTML,
    toast: toast, csve: csvEscape
  };
})();

window.GestWorkspace.restoreState();