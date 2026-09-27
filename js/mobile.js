/* ============================================================
   Application mobile (téléphone ≤ 720 px) : app simple avec
   des boutons en bas d'écran (Accueil / Formules / Services /
   Contact). Le site ordinateur (> 720 px) n'est pas affecté.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var MOB = window.matchMedia("(max-width: 720px)");

  var shell = $("#mob-shell");
  if (!shell) return;

  var screens = $$(".mob-screen");
  var backBtn = $("#mob-back");
  var burger = $("#mob-burger");
  var menuPanel = $("#mob-menu");

  /* ---------- Navigation entre écrans ---------- */
  function setScreen(view) {
    var exists = false;
    screens.forEach(function (s) {
      if (s.getAttribute("data-mob-view") === view) exists = true;
    });
    if (!exists) view = "home";
    screens.forEach(function (s) {
      var active = (s.getAttribute("data-mob-view") === view);
      s.hidden = !active;
      s.classList.toggle("active", active);
    });
    if (backBtn) backBtn.hidden = (view === "home");
    if (burger) burger.setAttribute("aria-expanded", "false");
    if (menuPanel) menuPanel.hidden = true;
    markTab(view);
    if (MOB.matches) {
      var sc = $("#mob-screen-" + view);
      if (sc) sc.scrollTop = 0;
    }
  }

  function openScreen(view) {
    if (!view) return;
    setScreen(view);
  }

  /* ---------- Barre d'onglets en bas ---------- */
  var TABS = [
    { key: "home", label: "Accueil", ico: "🏠", view: "home" },
    { key: "formules", label: "Formules", ico: "💼", view: "formules" },
    { key: "services", label: "Services", ico: "🛠️", view: "offres" },
    { key: "contact", label: "Contact", ico: "📩", view: "contact" }
  ];
  var tabsBar = document.createElement("nav");
  tabsBar.className = "mob-tabs";
  tabsBar.setAttribute("aria-label", "Navigation principale");
  var tabs = {};
  TABS.forEach(function (t) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mob-tab";
    b.setAttribute("data-mob-view", t.view);
    b.appendChild(document.createElement("span"));
    b.lastChild.className = "mob-tab-ico";
    b.lastChild.textContent = t.ico;
    b.appendChild(document.createElement("span"));
    b.lastChild.className = "mob-tab-label";
    b.lastChild.textContent = t.label;
    tabsBar.appendChild(b);
    tabs[t.key] = b;
  });
  shell.appendChild(tabsBar);

  function markTab(view) {
    var activeKey = "home";
    if (view === "formules") activeKey = "formules";
    else if (view === "contact") activeKey = "contact";
    else if (view !== "home") activeKey = "services";
    TABS.forEach(function (t) {
      tabs[t.key].classList.toggle("is-active", t.key === activeKey);
    });
  }

  /* ---------- Écran « Nos services » (liste complète) ---------- */
  var SERVICES = [
    { view: "pole-temps", ico: "⏱", label: "Vous manquez de temps", sub: "Secrétariat, devis, factures, impayés" },
    { view: "pole-visib", ico: "🌐", label: "On ne vous trouve pas", sub: "Site, Google, réseaux sociaux" },
    { view: "pole-marches", ico: "🏆", label: "Vous visez de nouveaux marchés", sub: "Accompagnement aux appels d'offres" },
    { view: "teleph", ico: "📞", label: "Secrétariat téléphonique", sub: "Vos appels, notre organisation" },
    { view: "builder", ico: "🧾", label: "Devis, factures et relances", sub: "Gestion administrative courante" },
    { view: "site", ico: "💻", label: "Création de site Internet", sub: "Un site professionnel à votre image" },
    { view: "appels", ico: "🎯", label: "Appels d'offres", sub: "Dossiers complets, de la veille au dépôt" },
    { view: "surmesure", ico: "✨", label: "Solution sur mesure", sub: "Un besoin spécifique ? Parlons-en" }
  ];
  var offresScreen = document.createElement("section");
  offresScreen.className = "mob-screen";
  offresScreen.id = "mob-screen-offres";
  offresScreen.setAttribute("data-mob-view", "offres");
  var offresTitle = document.createElement("div");
  offresTitle.className = "mob-screen-title";
  offresTitle.innerHTML = "<span>Nos services</span><em>Tout ce que GestAffaires peut faire pour vous.</em>";
  offresScreen.appendChild(offresTitle);
  var list = document.createElement("div");
  list.className = "mob-polesub";
  SERVICES.forEach(function (s) {
    var a = document.createElement("a");
    a.setAttribute("href", "#");
    a.setAttribute("data-mob-view", s.view);
    var span = document.createElement("span");
    span.textContent = s.ico;
    var strong = document.createElement("strong");
    strong.textContent = s.label;
    var em = document.createElement("em");
    em.textContent = s.sub;
    a.appendChild(span);
    a.appendChild(strong);
    a.appendChild(em);
    list.appendChild(a);
  });
  offresScreen.appendChild(list);
  var offresCta = document.createElement("button");
  offresCta.type = "button";
  offresCta.className = "btn btn-primary btn-block";
  offresCta.setAttribute("data-mob-view", "contact");
  offresCta.textContent = "Besoin d'un conseil ? Contactez-nous →";
  offresScreen.appendChild(offresCta);
  var mobMain = $(".mob-main", shell);
  if (mobMain) mobMain.appendChild(offresScreen);
  screens = $$(".mob-screen");

  /* ---------- Clics sur tous les éléments data-mob-view ----------
     Seuls les liens et boutons sont des déclencheurs : les écrans
     (section[data-mob-view]) ne le sont pas, sinon preventDefault()
     annulerait les cases à cocher, l'envoi du formulaire et les liens
     téléphone / WhatsApp à l'intérieur de chaque écran. */
  document.addEventListener("click", function (e) {
    if (!MOB.matches) return;
    var t = e.target && e.target.closest ? e.target.closest("a[data-mob-view], button[data-mob-view]") : null;
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      openScreen(t.getAttribute("data-mob-view"));
    }
  });

  if (backBtn) {
    backBtn.addEventListener("click", function () { openScreen("home"); });
  }
  if (burger) {
    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menuPanel.hidden;
      menuPanel.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (menuPanel && !menuPanel.hidden && !menuPanel.contains(e.target) && !burger.contains(e.target)) {
        menuPanel.hidden = true;
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Constructeur mobile (réutilise les données de main.js) ---------- */
  var GA = window.GA || { PRESTATIONS: {}, POOLS: {}, formatPrice: function (n) { return n + " €"; } };
  var mobBoxes = $$("#mob-builder .bitem input[data-b]");
  var mobTime = $("#mob-btime");
  var mobPrice = $("#mob-bprice");
  var mobNote = $("#mob-bnote");

  function mobBuilderUpdate() {
    var totalH = 0, scope = null;
    mobBoxes.forEach(function (cb) {
      if (!cb.checked) return;
      var p = GA.PRESTATIONS[cb.getAttribute("data-b")];
      if (!p) return;
      totalH += p.h;
      if (p.g === "acq") scope = "acq";
      else if (p.g === "visib" && scope !== "acq") scope = "visib";
      else if (p.g === "admin" && !scope) scope = "admin";
    });

    if (!mobTime || !mobPrice || !mobNote) return;

    if (!totalH) {
      mobTime.textContent = "≈ 0 h / mois";
      mobPrice.textContent = "—";
      mobNote.textContent = "Cochez une ou plusieurs prestations : on estime le temps nécessaire et la formule la plus adaptée.";
      return;
    }

    mobTime.textContent = "≈ " + totalH + " h / mois";

    if (totalH < 8) {
      mobPrice.textContent = "Sur devis";
      mobNote.textContent = "Besoin ponctuel : chaque prestation est facturée à l'unité, sans engagement.";
      return;
    }

    var pool = GA.POOLS[scope || "admin"];
    var tier = null;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].h >= totalH) { tier = pool[i]; break; }
    }
    var note;
    if (!tier) {
      tier = pool[pool.length - 1];
      note = "Formule la plus proche : " + tier.n + " (" + tier.h + " h incluses) — au-delà : 35 € / h supplémentaires.";
    } else {
      note = "Formule adaptée : " + tier.n + " (" + tier.h + " h incluses).";
    }
    mobPrice.textContent = GA.formatPrice(tier.p) + " / mois";
    mobNote.textContent = note;
  }

  if (mobBoxes.length) {
    mobBoxes.forEach(function (cb) {
      cb.addEventListener("change", function () {
        var lab = cb.closest(".bitem");
        if (lab) lab.classList.toggle("on", cb.checked);
        mobBuilderUpdate();
      });
    });
    mobBuilderUpdate();
  }

  /* ---------- Le héros de la page, repris tel quel dans l'accueil de l'app ---------- */
  var VIEW_BY_ANCHOR = {
    contact: "contact",
    diagnostic: "contact",
    rdv: "contact",
    services: "formules",
    formules: "formules",
    solution: "surmesure",
    surmesure: "surmesure",
    secretariat: "teleph",
    telephonie: "teleph",
    "creation-site": "site",
    site: "site",
    appels: "appels"
  };

  function mountHero() {
    var home = $("#mob-screen-home");
    var src = $("section.hero");
    if (!home || !src) return;
    var clone = src.cloneNode(true);

    /* Les dégradés SVG doivent rester uniques dans la page */
    $$("[id^='grad']", clone).forEach(function (n) {
      var old = n.getAttribute("id");
      var nn = "mob-" + old;
      n.setAttribute("id", nn);
      $$("[fill='url(#" + old + ")']", clone).forEach(function (u) {
        u.setAttribute("fill", "url(#" + nn + ")");
      });
    });
    /* Aucun identifiant en double */
    clone.removeAttribute("id");
    $$("[id]", clone).forEach(function (n) { n.removeAttribute("id"); });

    /* Les boutons du héros ouvrent les écrans de l'app */
    $$("a", clone).forEach(function (a) {
      var href = (a.getAttribute("href") || "").toLowerCase();
      var anchor = href.indexOf("#") > -1 ? href.split("#")[1] : "";
      a.setAttribute("href", "#");
      if (VIEW_BY_ANCHOR[anchor]) a.setAttribute("data-mob-view", VIEW_BY_ANCHOR[anchor]);
    });

    /* Les cartes du héros copié ne doivent pas rester masquées par
       l'animation d'apparition (opacity: 0) : sans cela elles laissent
       un grand vide vide en bas du héros. */
    $$(".reveal", clone).forEach(function (n) {
      n.classList.remove("reveal");
      n.classList.add("inview");
    });

    /* L'accueil garde seulement ses grandes cartes de services */
    $$(".mob-home-sub, .mob-home-title, .mob-home-intro", home).forEach(function (n) { n.remove(); });

    clone.classList.add("mob-hero");
    home.insertBefore(clone, home.firstChild);
  }

  /* ---------- Initialisation ---------- */
  mountHero();
  setScreen("home");

  if (MOB.addEventListener) {
    MOB.addEventListener("change", function () {
      setScreen("home");
    });
  }

})();