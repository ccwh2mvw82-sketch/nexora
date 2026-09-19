/* ============================================================
   NEXORA – Gestion & Digital
   Interactions : menu mobile, header, scrollspy, reveal,
   simulateur d'heures, FAQ, formulaires, modales, WhatsApp.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var header = $(".site-header");
  var navToggle = $("#nav-toggle");
  var mainNav = $("#main-nav");

  /* ---------- Header : ombre au scroll ---------- */
  function onScrollHeader() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 10);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- Menu mobile ---------- */
  function setMenu(open) {
    if (!mainNav) return;
    mainNav.classList.toggle("open", open);
    document.body.classList.toggle("no-scroll", open);
    if (navToggle) {
      navToggle.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    }
  }

  function closeMenu() {
    setMenu(false);
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenu(!mainNav.classList.contains("open"));
    });

    $$("a", mainNav).forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", function (e) {
      if (mainNav.classList.contains("open") && !mainNav.contains(e.target) && !navToggle.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ============================================================
     Mode mobile "appli" : page d'accueil + navigation par pages
     (uniquement sur téléphone ≤ 720 px ; tablette > 720 px
      conserve le défilement classique avec menu hamburger)
     ============================================================ */
  var mqMobile = window.matchMedia("(max-width: 720px)");
  var bodyEl = document.body;
  var mainEl = document.getElementById("contenu");
  var currentPage = "home";

  var PAGE_MAP = {
    "accueil": "home",
    "pourquoi": "services",
    "secteurs": "services",
    "services": "services",
    "solution": "solution",
    "formules": "home",
    "creation-site": "creation",
    "processus": "creation",
    "secretariat": "secretariat",
    "a-propos": "apropos",
    "temoignages": "apropos",
    "avis": "apropos",
    "realisations": "realisations",
    "faq": "faq",
    "cta-final": "contact",
    "contact": "contact"
  };

  function allMpages() {
    return ["home", "services", "solution", "creation", "secretariat", "apropos", "realisations", "faq", "contact"];
  }

  function applyMobileClasses() {
    var mobile = mqMobile.matches;
    bodyEl.classList.toggle("mobile", mobile);
    if (!mobile) {
      currentPage = "home";
      bodyEl.classList.remove("no-scroll");
      return;
    }
    allMpages().forEach(function (p) { bodyEl.classList.remove("mpage-" + p); });
    bodyEl.classList.add("mpage-" + currentPage);
  }

  function switchPage(pageName, anchorId) {
    var same = pageName === currentPage;
    currentPage = pageName;
    document.documentElement.style.scrollBehavior = "auto";
    allMpages().forEach(function (p) { bodyEl.classList.remove("mpage-" + p); });
    bodyEl.classList.add("mpage-" + pageName);
    if (!same && mainEl) {
      mainEl.classList.remove("pf");
      void mainEl.offsetWidth;
      mainEl.classList.add("pf");
    }
    if (!same) window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = "";
    if (anchorId) {
      var target = document.getElementById(anchorId);
      if (target) {
        setTimeout(function () {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    }
  }

  function handleHashNav(hash) {
    var id = hash.replace(/^#/, "");
    var pageName = PAGE_MAP[id] || "home";
    var anchor = (id === "formules") ? "formules" : null;
    switchPage(pageName, anchor);
    $$(".nav-link").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === hash);
    });
  }

  document.addEventListener("click", function (e) {
    if (!mqMobile.matches) return;
    var link = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    link.blur && link.blur();
    if (link.hasAttribute("data-modal")) return;
    var href = link.getAttribute("href");
    if (!href || href === "#") return;
    e.preventDefault();
    closeMenu();
    handleHashNav(href);
  });

  if (mqMobile.addEventListener) {
    mqMobile.addEventListener("change", applyMobileClasses);
  } else if (mqMobile.addListener) {
    mqMobile.addListener(applyMobileClasses);
  }
  applyMobileClasses();

  /* ---------- Scrollspy ---------- */
  var sections = $$("main section[id]").map(function (s) {
    return { id: s.id, el: s };
  });

  function spy() {
    if (mqMobile.matches || !header) return;
    var pos = window.scrollY + header.offsetHeight + 90;
    var current = sections[0] ? sections[0].id : null;
    sections.forEach(function (sec) {
      if (sec.el.offsetTop <= pos) current = sec.id;
    });
    $$(".nav-link").forEach(function (link) {
      var secId = link.getAttribute("href");
      var page = PAGE_MAP[secId && secId.replace(/^#/, "")];
      if (page === "home" || page === "services") return;
      link.classList.toggle("active", secId === "#" + current);
    });
  }
  if (sections.length) {
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  /* ---------- Apparition au scroll (reveal) ---------- */
  $$(".section-head, .adv-card, .feature-card, .serv-card, .price-card, .step, .sector-card, .creation-option, .value, .calculator, .sv-card, .flow-step, .srv-cap, .work-card, .founder-card").forEach(function (el) {
    el.classList.add("reveal");
  });

  var revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("inview");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("inview"); });
  }

  /* ---------- FAQ accordéon ---------- */
  $$(".faq-item").forEach(function (item) {
    var btn = $(".faq-q", item);
    var answer = $(".faq-a", item);
    if (!btn || !answer) return;
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      $$(".faq-item.open").forEach(function (other) {
        other.classList.remove("open");
        $(".faq-q", other).setAttribute("aria-expanded", "false");
        $(".faq-a", other).style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });

  /* ---------- Calculateur d'heures ---------- */
  var ORDER = ["4", "6", "7", "8", "10", "12", "15", "20"];
  var PRICING = {
    "4":  { price: 249, formula: "Formule conseillée : Essentiel" },
    "6":  { price: 319, formula: "Formule conseillée : Essentiel+" },
    "7":  { price: 449, formula: "Formule conseillée : Business", plus: "La plus choisie" },
    "8":  { price: 389, formula: "Formule conseillée : Essentiel+" },
    "10": { price: 459, formula: "Formule conseillée : Essentiel+ 10 h", plus: "ou Premium (699 €) pour un accompagnement digital complet" },
    "12": { price: null, label: "Sur devis" },
    "15": { price: null, label: "Sur devis" },
    "20": { price: null, label: "Sur devis" }
  };

  var calcOptions = $("#calc-options");
  var calcPrice = $("#calc-price");
  var calcNote = $("#calc-note");
  var calcResult = $("#calc-result");

  function formatPrice(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
  }

  if (calcOptions && calcPrice && calcNote) {
    var options = $$(".calc-opt", calcOptions);

    function selectOption(hours) {
      options.forEach(function (opt) {
        opt.classList.toggle("selected", opt.getAttribute("data-hours") === hours);
      });
      var data = PRICING[hours];
      if (!data) return;

      if (data.price === null) {
        var label = data.label || "Sur devis";
        calcPrice.innerHTML = label;
        calcNote.innerHTML = "<strong>Besoin de plus de 10 heures ?</strong> <a href=\"#solution\">Demandez une offre sur mesure.</a>";
      } else {
        calcPrice.innerHTML = "<span id='calcPriceNum'>" + formatPrice(data.price) + "</span><small> / mois</small>";
        var note = "<strong>" + data.formula + "</strong> ≈ " + formatPrice(data.price) + " / mois";
        if (data.plus) note += "<br>" + data.plus + ".";
        calcNote.innerHTML = note;
      }
      if (calcResult) calcResult.setAttribute("data-hours", hours);
    }

    options.forEach(function (opt) {
      opt.addEventListener("click", function () {
        selectOption(opt.getAttribute("data-hours"));
      });
    });

    selectOption("8");
  }

  /* ---------- Formulaires ---------- */
  function initForm(form) {
    var successId = form.getAttribute("data-success");
    var success = successId ? document.getElementById(successId) : null;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  }
  $$("form.js-form").forEach(initForm);

  /* ---------- Modales légales ---------- */
  var modals = $$(".modal");
  function openModal(id) {
    var m = $(id);
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = $(".modal-close", m);
    if (closeBtn) closeBtn.focus();
  }
  function closeModal(m) {
    m.hidden = true;
    document.body.style.overflow = "";
  }
  function closeAllModals() {
    modals.forEach(function (m) { m.hidden = true; });
    document.body.style.overflow = "";
  }
  $$("[data-modal]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      closeAllModals();
      openModal("#modal-" + link.getAttribute("data-modal"));
    });
  });
  modals.forEach(function (m) {
    $$("[data-close]", m).forEach(function (el) {
      el.addEventListener("click", function () { closeModal(m); });
    });
    $$("button[data-close], .modal-close", m).forEach(function (el) {
      el.addEventListener("click", function () { closeModal(m); });
    });
  });

  /* ---------- CTA mobile historique (remplacée par la barre d'action) ---------- */
  var mobileCta = $("#mobile-cta");
  if (mobileCta) {
    function toggleMobileCta() {
      if (window.innerWidth > 720) return;
      var nearContact = false;
      var contact = $("#contact");
      if (contact) {
        var r = contact.getBoundingClientRect();
        nearContact = r.top < window.innerHeight && r.bottom > 0;
      }
      mobileCta.classList.toggle("visible", window.scrollY > 520 && !nearContact);
    }
    window.addEventListener("scroll", toggleMobileCta, { passive: true });
    toggleMobileCta();
  }

})();