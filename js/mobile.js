/* ============================================================
   Application mobile (téléphone ≤ 720 px) : sphère 3D + menus.
   Le site ordinateur (> 720 px) n'est pas affecté.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var MOB = window.matchMedia("(max-width: 720px)");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var MENUS = [
    { key: "formules", label: "Nos formules", ico: "💶" },
    { key: "builder", label: "Créer ma formule", ico: "🧩" },
    { key: "site", label: "Création de site", ico: "💻" },
    { key: "teleph", label: "Service téléphonique", ico: "📞" },
    { key: "surmesure", label: "Solution sur mesure", ico: "✨" },
    { key: "contact", label: "Contact & diagnostic", ico: "📩" }
  ];
  var STEP = 360 / MENUS.length;

  var shell = $("#mob-shell");
  if (!shell) return;

  var ring = $("#mob-ring");
  var orbEls = [];
  var current = 0;
  var angle = 0;
  var wheelAcc = 0;

  /* ---------- Sphère 3D ---------- */
  MENUS.forEach(function (m, i) {
    var orb = document.createElement("button");
    orb.type = "button";
    orb.className = "mob-orb" + (i === current ? " active" : "");
    orb.setAttribute("aria-label", m.label);
    orb.textContent = m.ico;
    orb.style.transform = "rotateX(" + (i * STEP) + "deg) translateZ(168px)";
    orb.addEventListener("click", function () {
      openScreen(m.key);
    });
    ring.appendChild(orb);
    orbEls.push(orb);
  });

  function refreshOrbs() {
    orbEls.forEach(function (orb, i) {
      orb.classList.toggle("active", i === current);
    });
    $("#mob-open-ico").textContent = MENUS[current].ico;
    $("#mob-open-label").textContent = MENUS[current].label;
  }

  function applyAngle(animate) {
    if (reduceMotion.matches) animate = false;
    if (animate) {
      ring.style.transition = "transform .45s cubic-bezier(.22,.61,.36,1)";
    } else {
      ring.style.transition = "none";
    }
    angle = -(current * STEP);
    ring.style.transform = "rotateX(" + angle + "deg)";
  }

  function turn(delta) {
    var prev = current;
    current = (current + delta + MENUS.length) % MENUS.length;
    if (current !== prev) refreshOrbs();
    applyAngle(true);
  }

  $("#mob-open").addEventListener("click", function () {
    openScreen(MENUS[current].key);
  });

  /* Rotation via molette / geste vertical sur l'accueil */
  var screenHome = $("#mob-screen-home");
  window.addEventListener("wheel", function (e) {
    if (!MOB.matches || !isHomeActive()) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    var thresh = 60;
    while (wheelAcc >= thresh) { turn(1); wheelAcc -= thresh; }
    while (wheelAcc <= -thresh) { turn(-1); wheelAcc += thresh; }
  }, { passive: false });

  var touchStartY = null;
  window.addEventListener("touchstart", function (e) {
    if (!MOB.matches || !isHomeActive()) return;
    touchStartY = e.touches[0] ? e.touches[0].clientY : null;
  }, { passive: true });

  window.addEventListener("touchend", function (e) {
    if (!MOB.matches || !isHomeActive() || touchStartY === null) return;
    var dy = touchStartY - (e.changedTouches[0] ? e.changedTouches[0].clientY : touchStartY);
    touchStartY = null;
    if (Math.abs(dy) < 40) return;
    turn(dy > 0 ? 1 : -1);
  }, { passive: true });

  function isHomeActive() {
    return screenHome && !screenHome.hasAttribute("hidden");
  }

  /* ---------- Navigation entre écrans ---------- */
  var screens = $$(".mob-screen");
  var backBtn = $("#mob-back");
  var burger = $("#mob-burger");
  var menuPanel = $("#mob-menu");

  function setScreen(view) {
    screens.forEach(function (s) {
      s.hidden = (s.getAttribute("data-mob-view") !== view);
      s.classList.toggle("active", s.getAttribute("data-mob-view") === view);
    });
    backBtn.hidden = (view === "home");
    burger.setAttribute("aria-expanded", "false");
    menuPanel.hidden = true;
    if (view !== "home" && MOB.matches) {
      var first = $("#mob-screen-" + view);
      if (first) first.scrollTop = 0;
    }
  }

  function openScreen(view) {
    if (!view) return;
    if (view === "home") {
      applyAngle(true);
    } else if (view === "formules") {
      resetCarousel();
    }
    setScreen(view);
  }

  if (menuPanel) {
    menuPanel.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-mob-view]") : null;
      if (t) { e.preventDefault(); openScreen(t.getAttribute("data-mob-view")); }
    });
  } else {
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-mob-view]") : null;
      if (t) { e.preventDefault(); openScreen(t.getAttribute("data-mob-view")); return; }
    });
  }

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
      if (!menuPanel.hidden && !menuPanel.contains(e.target) && !burger.contains(e.target)) {
        menuPanel.hidden = true;
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Carrousel des formules ---------- */
  var FORMULA_ORDER = ["essentiel", "confort", "visibilite", "visibilite-plus", "pro", "developpement"];
  var DEFAULTS = { numero: 2, name: "Visibilité" };
  var cards = $$("#mob-cards .mob-card");

  function resetCarousel() {
    var i = DEFAULTS.numero;
    cards.forEach(function (c, idx) { c.classList.toggle("active", idx === i); });
    $$(".mob-dot", $("#mob-dots")).forEach(function (d, idx) { d.classList.toggle("on", idx === i); });
    applyArrows(i);
  }

  function applyArrows(i) {
    $("#mob-prev").disabled = (i === 0);
    $("#mob-next").disabled = (i === cards.length - 1);
  }

  function buildDots() {
    var dots = $("#mob-dots");
    dots.innerHTML = "";
    cards.forEach(function (c, i) {
      var d = document.createElement("span");
      d.className = "mob-dot" + (i === DEFAULTS.numero ? " on" : "");
      d.addEventListener("click", function () { goto( i); });
      dots.appendChild(d);
    });
  }

  function goto(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    cards.forEach(function (c, idx) { c.classList.toggle("active", idx === i); });
    $$(".mob-dot", $("#mob-dots")).forEach(function (d, idx) { d.classList.toggle("on", idx === i); });
    applyArrows(i);
  }

  if ($("#mob-prev")) {
    $("#mob-prev").addEventListener("click", function () {
      var i = cards.indexOf(document.querySelector("#mob-cards .mob-card.active"));
      goto(i - 1);
    });
    $("#mob-next").addEventListener("click", function () {
      var i = cards.indexOf(document.querySelector("#mob-cards .mob-card.active"));
      goto(i + 1);
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

  /* ---------- Initialisation ---------- */
  setScreen("home");
  buildDots();
  resetCarousel();
  refreshOrbs();
  applyAngle(false);

  if (MOB.addEventListener) {
    MOB.addEventListener("change", function () {
      var active = $("#mob-screen-" + (MOB.matches ? "home" : "home"));
      setScreen("home");
      applyAngle(false);
    });
  }

})();