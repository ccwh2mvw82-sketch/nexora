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

  var POLES = [
    { key: "pole-temps", label: "Vous manquez de temps", ico: "⏱" },
    { key: "pole-visib", label: "On ne vous trouve pas", ico: "🌐" },
    { key: "pole-marches", label: "Vous visez de nouveaux marchés", ico: "🏆" },
    { key: "surmesure", label: "Solution sur mesure", ico: "✨" }
  ];
  var shell = $("#mob-shell");
  if (!shell) return;
  var ring = $("#mob-ring");
  var globe = $(".mob-globe");
  var orbEls = [];
  var current = 0;
  var rx = 0;
  var ry = 0;
  var dragging = false;
  var dragX = 0;
  var acc = 0;
  var moved = 0;
  var blockClick = false;
  var R = 140;
  var STEP = 90;  /* ecart angulaire entre les poles */
  var TRIG = 60;  /* deltas px pour declencher un pas */
  var SLOTS = [
    { az: 0, alt: 0 },
    { az: 90, alt: 0 },
    { az: 180, alt: 0 },
    { az: 270, alt: 0 }
  ];
  function seg(v) { return v * Math.PI / 180; }
  /* ---------- Sphere 3D : rotation par pas (le tour suivant est selectionne) ---------- */
  POLES.forEach(function (m, i) {
    var orb = document.createElement("button");
    orb.type = "button";
    orb.className = "mob-orb" + (i === current ? " active" : "");
    orb.setAttribute("aria-label", m.label);
    orb.textContent = m.ico;
    orb.style.transform = "rotateY(" + SLOTS[i].az + "deg) rotateX(" + SLOTS[i].alt + "deg) translateZ(" + R + "px)";
    orb.addEventListener("click", function () {
      if (blockClick) { blockClick = false; return; }
      openScreen(m.key);
    });
    ring.appendChild(orb);
    orbEls.push(orb);
  });
  function refreshOrbs() {
    orbEls.forEach(function (orb, i) {
      orb.classList.toggle("active", i === current);
    });
    $("#mob-open-ico").textContent = POLES[current].ico;
    $("#mob-open-label").textContent = POLES[current].label;
  }
  function animateRing() {
    if (!ring) return;
    var dur = (reduceMotion.matches) ? "none" : "transform .55s cubic-bezier(.3,1.4,.4,1)";
    ring.style.transition = dur;
    ring.style.transform = "rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
    if (globe) {
      globe.style.transition = dur;
      globe.style.transform = "rotateY(" + (-ry) + "deg)";
    }
  }
  function step(dir) {
    current = (current + dir + POLES.length) % POLES.length;
    ry = -current * STEP;
    refreshOrbs();
    animateRing();
  }
  function render() {
    ry = -current * STEP;
    refreshOrbs();
    animateRing();
  }
  $("#mob-open").addEventListener("click", function () {
    if (blockClick) { blockClick = false; return; }
    openScreen(POLES[current].key);
  });
  /* Glisser : chaque deplacement declenche directement le pole suivant (direct) */
  window.addEventListener("pointerdown", function (e) {
    if (!MOB.matches || !isHomeActive()) return;
    dragging = true;
    blockClick = false;
    dragX = e.clientX;
    acc = 0;
    moved = 0;
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging || !MOB.matches || !isHomeActive()) return;
    var dx = e.clientX - dragX;
    dragX = e.clientX;
    moved += Math.abs(dx);
    acc += dx;
    while (Math.abs(acc) >= TRIG) {
      step(acc >= 0 ? 1 : -1);
      acc -= TRIG * (acc >= 0 ? 1 : -1);
    }
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (moved > 10) blockClick = true;
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  /* Molette / pad tactile : un pas par cran (vertical ou horizontal) */
  var wheelAcc = 0;
  var TRIGW = 120;
  window.addEventListener("wheel", function (e) {
    if (!MOB.matches || !isHomeActive()) return;
    e.preventDefault();
    wheelAcc += (e.deltaY + e.deltaX);
    while (Math.abs(wheelAcc) >= TRIGW) {
      step(wheelAcc >= 0 ? 1 : -1);
      wheelAcc -= TRIGW * (wheelAcc >= 0 ? 1 : -1);
    }
}, { passive: false });

  var screenHome = $("#mob-screen-home");
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
      render();
    } else if (view === "formules") {
      resetCarousel();
    }
    setScreen(view);
  }

  /* Boutons d'action présents dans les écrans (hors menu et hors sections elles-mêmes) */
  $$("#mob-shell [data-mob-view]").forEach(function (el) {
    if (menuPanel && menuPanel.contains(el)) return;
    if (el.classList && el.classList.contains("mob-screen")) return;
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openScreen(el.getAttribute("data-mob-view"));
    });
  });

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
  render();

  if (MOB.addEventListener) {
    MOB.addEventListener("change", function () {
      var active = $("#mob-screen-" + (MOB.matches ? "home" : "home"));
      setScreen("home");
      render();
    });
  }

})();