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
    { key: "pole-marches", label: "Vous visez de nouveaux marchés", ico: "🏆" }
  ];
  var shell = $("#mob-shell");
  if (!shell) return;

  var ring = $("#mob-ring");
  var orbEls = [];
  var current = 0;
  var rx = 0;
  var ry = 0;
  var dragging = false;
  var dragX = 0;
  var dragY = 0;
  var moved = 0;
  var blockClick = false;
  var R = 140;
  var SLOTS = [
    { az: 0, alt: 0 },     /* 0 temps — devant */
    { az: 120, alt: 0 },   /* 1 visibilité — droite arrière */
    { az: 240, alt: 0 }    /* 2 marchés — gauche arrière */
  ];

  function seg(v) { return v * Math.PI / 180; }

  function clampRx() {
    if (rx > 90) rx = 90;
    if (rx < -90) rx = -90;
  }

  /* Profondeur caméra d'un orbe (la plus grande = le plus proche) */
  function orbDepth(i) {
    var a = seg(SLOTS[i].az), t = seg(SLOTS[i].alt);
    var vx = 0, vy = 0, vz = R;
    var cs = Math.cos(t), sn = Math.sin(t);
    var ny = vy * cs - vz * sn;
    var nz = vy * sn + vz * cs;
    vy = ny; vz = nz;
    cs = Math.cos(a); sn = Math.sin(a);
    var nx = vx * cs + vz * sn;
    var nz2 = -vx * sn + vz * cs;
    vx = nx; vz = nz2;
    cs = Math.cos(seg(ry)); sn = Math.sin(seg(ry));
    nx = vx * cs + vz * sn;
    nz2 = -vx * sn + vz * cs;
    vx = nx; vz = nz2;
    cs = Math.cos(seg(rx)); sn = Math.sin(seg(rx));
    ny = vy * cs - vz * sn;
    nz2 = vy * sn + vz * cs;
    vy = ny; vz = nz2;
    return vz;
  }

  /* ---------- Sphère 3D ---------- */
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

  function render() {
    if (!ring) return;
    ring.style.transition = (dragging || reduceMotion.matches) ? "none" : "transform .16s ease-out";
    ring.style.transform = "rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
    var best = 0, bz = -Infinity;
    orbEls.forEach(function (orb, i) {
      var z = orbDepth(i);
      if (z > bz) { bz = z; best = i; }
      var s = 0.7 + 0.35 * (z / R + 1) / 2;
      orb.style.transform = "rotateY(" + SLOTS[i].az + "deg) rotateX(" + SLOTS[i].alt + "deg) translateZ(" + R + "px) scale(" + s.toFixed(3) + ")";
    });
    if (best !== current) {
      current = best;
      refreshOrbs();
    }
  }

  $("#mob-open").addEventListener("click", function () {
    if (blockClick) { blockClick = false; return; }
    openScreen(POLES[current].key);
  });

  /* Rotation libre : glisser dans toutes les directions, la sphère suit le doigt */
  window.addEventListener("pointerdown", function (e) {
    if (!MOB.matches || !isHomeActive()) return;
    dragging = true;
    blockClick = false;
    dragX = e.clientX;
    dragY = e.clientY;
    moved = 0;
    ring.style.transition = "none";
  });

  window.addEventListener("pointermove", function (e) {
    if (!dragging || !MOB.matches || !isHomeActive()) return;
    var dx = e.clientX - dragX;
    var dy = e.clientY - dragY;
    dragX = e.clientX;
    dragY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    ry += dx * 0.45;
    rx -= dy * 0.45;
    clampRx();
    render();
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (moved > 10) blockClick = true;
    render();
  }

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* Rotation via molette / pavé tactile (vertical : bascule, horizontal : orbite) */
  var screenHome = $("#mob-screen-home");
  window.addEventListener("wheel", function (e) {
    if (!MOB.matches || !isHomeActive()) return;
    e.preventDefault();
    ry += e.deltaX * 0.3;
    rx += e.deltaY * 0.3;
    clampRx();
    render();
  }, { passive: false });

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