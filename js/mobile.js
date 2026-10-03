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

  /* ---------- Écran FAQ ----------
     La FAQ du site (#faq) est reprise telle quelle plutôt que
     réécrite : une seule source de contenu, donc jamais de question
     sans réponse ou de réponse périmée. Les questions dupliquées
     répondent grâce à la délégation d'événement de main.js. */
  var faqSource = document.getElementById("faq");
  if (faqSource) {
    var faqScreen = document.createElement("section");
    faqScreen.className = "mob-screen";
    faqScreen.id = "mob-screen-faq";
    faqScreen.setAttribute("data-mob-view", "faq");
    var faqTitle = document.createElement("div");
    faqTitle.className = "mob-screen-title";
    faqTitle.innerHTML = "<span>Questions fr\u00e9quentes</span><em>Les r\u00e9ponses aux questions qu'on nous pose le plus.</em>";
    faqScreen.appendChild(faqTitle);
    var faqList = document.createElement("div");
    faqList.className = "faq-list";
    var faqItems = $$(".faq-item", faqSource);
    if (faqItems.length) {
      faqItems.forEach(function (src) { faqList.appendChild(src.cloneNode(true)); });
    } else {
      var vide = document.createElement("p");
      vide.className = "mob-note";
      vide.textContent = "Aucune question frequent r\u00e9ponse pour le moment.";
      faqList.appendChild(vide);
    }
    faqScreen.appendChild(faqList);
    var faqCta = document.createElement("button");
    faqCta.type = "button";
    faqCta.className = "btn btn-primary btn-block";
    faqCta.setAttribute("data-mob-view", "contact");
    faqCta.textContent = "Une autre question ? \u00c9crivez-nous \u2192";
    faqScreen.appendChild(faqCta);
    if (mobMain) mobMain.appendChild(faqScreen);
  }

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
    if (!mobTime || !mobPrice || !mobNote) return;
    var keys = [], i, cb;
    for (i = 0; i < mobBoxes.length; i++) {
      cb = mobBoxes[i];
      if (cb.checked) keys.push(cb.getAttribute("data-b"));
    }
    if (typeof GA.recommend !== "function") {
      mobTime.textContent = "≈ 0 h / mois";
      mobPrice.textContent = "—";
      mobNote.textContent = "Cochez une ou plusieurs prestations : on estime le temps nécessaire et la formule la plus adaptée.";
      return;
    }
    var r = GA.recommend(keys);
    mobTime.textContent = r.time;
    if (r.markup) {
      var shown = (typeof GA.commitPrice === "function") ? GA.commitPrice(r.price) : r.price;
      mobPrice.textContent = GA.formatPrice(shown) + " / mois HT";
      var extra = document.createElement("span");
      extra.className = "mob-bresult-commit";
      extra.textContent = (typeof GA.commitWord === "function" ? GA.commitWord() : "sans engagement");
      var wrap = document.createElement("div");
      wrap.innerHTML = r.note;
      while (wrap.firstChild) mobNote.appendChild(wrap.firstChild);
      mobNote.appendChild(extra);
      return;
    }
    mobPrice.textContent = r.price;
    var note2 = document.createElement("div");
    note2.innerHTML = r.note;
    mobNote.textContent = "";
    while (note2.firstChild) mobNote.appendChild(note2.firstChild);
  }

  document.addEventListener("ga:commit", function () {
    if (mobBoxes && mobBoxes.length) { mobBuilderUpdate(); }
  });

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

  /* ---------- Ouverture par ancre (ex: index.html#faq) ----------
     Sur ordinateur, l'ancre fait défiler la page. Sur téléphone, le
     contenu vit dans l'application : sans ce routage, arriving sur
     index.html#faq affichait l'accueil et la FAQ restait invisible,
     les liens "FAQ" des pages poles semblaient donc ne mener nulle
     part. */
  var ANCHOR_VIEWS = {
    "faq": "faq",
    "contact": "contact",
    "formules": "formules",
    "tarifs": "formules",
    "services": "offres",
    "pole-temps": "pole-temps",
    "pole-visibilite": "pole-visib",
    "pole-marches": "pole-marches",
    "accueil": "home"
  };

  function openFromHash() {
    if (!MOB.matches) return;
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return;
    var view = ANCHOR_VIEWS[id];
    if (!view) return;
    if (!screens.some(function (s) { return s.getAttribute("data-mob-view") === view; })) return;
    setScreen(view);
  }

  window.addEventListener("hashchange", openFromHash);

  /* ---------- Initialisation ---------- */
  mountHero();
  setScreen("home");
  openFromHash();

  function onViewportChange() {
    openFromHash();
    syncShellA11y();
  }
  if (MOB.addEventListener) {
    MOB.addEventListener("change", onViewportChange);
  } else if (MOB.addListener) {
    MOB.addListener(onViewportChange);
  }

  /* ---------- Accessibilité de la coquille mobile ----------
     #mob-shell porte aria-hidden="true" dans le HTML : c'est correct sur
     ordinateur (l'application mobile est masquee par le CSS), mais faux
     sur telephone, ou tout le contenu devient visible tout en restant
     annonce comme invisible aux lecteurs d'ecran, et devient focusable
     au clavier. On bascule donc l'attribut selon la largeur reelle. */
  function syncShellA11y() {
    if (!shell) return;
    var mobile = MOB.matches;
    shell.setAttribute("aria-hidden", mobile ? "false" : "true");
    /* Sur ordinateur, on neutralise aussi le focus : sans cela, le
       contenu masque reste atteignable avec la touche Tab. */
    $$('a, button, input, select, textarea', shell).forEach(function (el) {
      if (mobile) {
        if (el.hasAttribute("data-mob-tabindex")) {
          el.setAttribute("tabindex", el.getAttribute("data-mob-tabindex"));
          el.removeAttribute("data-mob-tabindex");
        }
      } else if (!el.hasAttribute("data-mob-tabindex")) {
        el.setAttribute("data-mob-tabindex", el.getAttribute("tabindex") || "");
        el.setAttribute("tabindex", "-1");
      }
    });
  }
  syncShellA11y();

})();