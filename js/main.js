/* ============================================================
   GestAffaires – Gestion · Administration · Digital
   Interactions : menu mobile, header, scrollspy, reveal,
   simulateur d'heures, FAQ, formulaires, modales, WhatsApp.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var header = $(".site-header");
  var navToggle = $("#nav-toggle");

  /* ---------- Informations société (source unique : js/site-info.js) ----------
     Le HTML contient deja un texte de repli dans chaque marqueur, ce qui
     garantit un affichage correct meme si le script est bloque ou
     desactive, et donne un contenu lisible aux moteurs de recherche. */
  var SITE = window.GA_SITE || null;
  function isReal(val) { return !!val && val !== "TODO"; }

  function applySiteInfo() {
    if (!SITE) return;
    /* Reseaux : un profil sans URL est masque, plutot que de laisser un
       href="#" inerte qui laisse croire a un lien fonctionnel. */
    var nets = {
      "linkedin": SITE.linkedin,
      "facebook": SITE.facebook,
      "instagram": SITE.instagram,
      "google-reviews": SITE.googleReviews
    };
    $$("[data-social]").forEach(function (a) {
      var url = nets[a.getAttribute("data-social")];
      var item = a.closest ? a.closest("li") : null;
      if (isReal(url)) {
        a.href = url;
        a.removeAttribute("aria-disabled");
        a.removeAttribute("data-no-link");
        a.hidden = false;
        if (item) item.hidden = false;
      } else {
        a.setAttribute("aria-disabled", "true");
        a.hidden = true;
        if (item) item.hidden = true;
      }
    });
    /* Liens de contact : on remplace le marqueur "REPLACE" par la valeur
       reelle, sur TOUS les liens de la page (footer, bouton flottant,
       coquille mobile), qu'ils portent ou non un marqueur data-site. */
    $$('a[href="tel:REPLACE"]').forEach(function (a) { a.href = "tel:+" + SITE.phoneDigits; });
    $$('a[href*="wa.me/REPLACE"]').forEach(function (a) { a.href = "https://wa.me/" + SITE.phoneDigits; });
    $$('a[href="mailto:REPLACE"]').forEach(function (a) { a.href = "mailto:" + SITE.email; });

    /* Textes : seules les valeurs reelles remplacent le repli du HTML. */
    $$("[data-site]").forEach(function (el) {
      var key = el.getAttribute("data-site");
      var val = SITE[key];
      if (!isReal(val)) return;
      if (el.getAttribute("data-site-content") === "text") {
        el.textContent = val;
      }
    });
    /* Blocs entiers (adresse, lignes de mentions) : affiches seulement
       si la valeur est renseignee, pour ne jamais publier "TODO". */
    $$("[data-site-if]").forEach(function (el) {
      var val = SITE[el.getAttribute("data-site-if")];
      el.hidden = !isReal(val);
    });
  }
  applySiteInfo();
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
    "tarifs": "home",
    "creer-ma-formule": "home",
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

  /* Défilement vers une ancre sur ordinateur.
   La position est calculée pour dégager l'en-tête fixe, sinon la
   section visée arrive collée sous le bandeau et son titre reste
   invisible. */
function scrollToAnchor(id) {
    var target = document.getElementById(id);
    if (!target) return false;
    var headerH = header ? header.offsetHeight : 0;
    var top = target.getBoundingClientRect().top +
              (window.pageYOffset || document.documentElement.scrollTop) - headerH - 14;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    return true;
  }

  function handleHashNav(hash) {
    var id = hash.replace(/^#/, "");
    /* Sur téléphone, une ancre ne désigne pas une position de défilement
       mais l'écran de l'application à afficher. Sur ordinateur, le contenu
       est un long texte : il faut défiler, sinon le clic n'a aucun effet
       visible alors que l'ancre existe. */
    if (mqMobile.matches) {
      var pageName = PAGE_MAP[id] || "home";
      var anchor = (id === "formules") ? "formules" : null;
      switchPage(pageName, anchor);
    } else if (!scrollToAnchor(id)) {
      /* Ancre inconnue : on revient au haut plutôt que de laisser le
         visiteur sur place en croyant que le lien est cassé. */
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", hash);
    }
    markActiveNav(hash);
  }

  /* Sur ordinateur, une ancre est un simple lien : le navigateur gère le
     défilement, et le CSS fournit déjà scroll-behavior: smooth ainsi
     que scroll-padding-top pour dégager l'en-tête fixe. Intercepter le
     clic ici annulait ce comportement et ne scrollingait pas : les
     liens du menu (#solution, #a-propos, #faq, #contact) ne
     produisaient alors aucun effet visible. */
  function markActiveNav(href) {
    $$(".nav-link").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === href);
    });
  }

  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    link.blur && link.blur();
    if (link.hasAttribute("data-modal")) return;
    var href = link.getAttribute("href");
    if (!href || href === "#") return;
    closeMenu();
    if (mqMobile.matches) {
      e.preventDefault();
      handleHashNav(href);
    } else {
      markActiveNav(href);
    }
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

  /* ---------- FAQ accordéon ----------
     Délégation d'événement plutôt qu'un écouteur par question : la
     FAQ est dupliquée dans l'écran FAQ de l'application mobile, et
     une liste dupliquée après coup n'aurait sinon aucun gestionnaire
     (les questions resteraient inertes). */
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".faq-q") : null;
    if (!btn) return;
    var item = btn.closest ? btn.closest(".faq-item") : null;
    if (!item) return;
    var answer = $(".faq-a", item);
    if (!answer) return;
    var isOpen = item.classList.contains("open");
    $$(".faq-item.open").forEach(function (other) {
      other.classList.remove("open");
      var ob = $(".faq-q", other);
      var oa = $(".faq-a", other);
      if (ob) ob.setAttribute("aria-expanded", "false");
      if (oa) oa.style.maxHeight = null;
    });
    if (!isOpen) {
      item.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      answer.style.maxHeight = answer.scrollHeight + "px";
    }
  });

  /* ---------- Composez votre formule ---------- */
  var EXTRA_HOUR = 109;

  var PRESTATIONS = {
    devis:      { h: 2, g: "admin" },
    factures:   { h: 3, g: "admin" },
    relances:   { h: 2, g: "admin" },
    suivi:      { h: 2, g: "admin" },
    classement: { h: 2, g: "admin" },
    tableaux:   { h: 2, g: "admin" },
    impayes:    { h: 3, g: "admin" },
    compta:     { h: 4, g: "admin" },
    secre:      { h: 4, g: "secre" },

    gbp:        { h: 2, g: "visib" },
    seo:        { h: 3, g: "visib" },
    presence:   { h: 2, g: "visib" },
    avis:       { h: 1, g: "visib" },
    res1:       { h: 5, g: "visib" },
    visuels:    { h: 3, g: "visib" },
    contenus:   { h: 3, g: "visib" },
    res2:       { h: 4, g: "visib" },

    offresveille:  { h: 2, g: "marches" },
    offresanalyse: { h: 3, g: "marches" },
    appels:        { h: 7, g: "marches" },

    strat:      { h: 2, g: "projet" },
    wa:         { h: 2, g: "projet" },
    adsopt:     { h: 3, g: "projet" },
    site:       { h: 5, g: "projet" },
    ads:        { h: 7, g: "projet" }
  };

  var POOLS = {
    admin: [
      { h: 7,  p: 799,  n: "Fondations" },
      { h: 11, p: 1099, n: "Essentiel" },
      { h: 16, p: 1599, n: "Confort" },
      { h: 24, p: 2099, n: "Pro" }
    ],
    visib: [
      { h: 8,  p: 990,  n: "Notoriété" },
      { h: 16, p: 1599, n: "Acquisition" },
      { h: 23, p: 2099, n: "Acquisition Plus" }
    ],
    secre: [
      { h: 4, p: 356, n: "Secrétariat téléphonique" }
    ],
    marches: [],
    projet: []
  };

  function formatPrice(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
  }

  /* ---------- Choix de l'engagement ---------- */
  var COMMIT_MODES = {
    none: { f: 1, label: "Sans engagement" },
    "6":   { f: 0.9, label: "Engagement 6 mois" },
    "12":  { f: 0.8, label: "Engagement 12 mois" }
  };
  var commitMode = "none";

  function commitPrice(p) {
    var f = COMMIT_MODES[commitMode].f;
    return f === 1 ? p : Math.round(p * f);
  }

  function commitWord() {
    if (commitMode === "none") return "sans engagement";
    return "en engagement " + commitMode + " mois";
  }

  function commitSaving(base) {
    var diff = base - commitPrice(base);
    if (!diff) return "Prix plein, sans engagement : vous restez libre de partir à tout moment.";
    return formatPrice(diff) + " de moins par mois";
  }

  function applyCommit() {
    var m = COMMIT_MODES[commitMode];
    var i, n, base;
    var prices = document.querySelectorAll("[data-base]");
    for (i = 0; i < prices.length; i++) {
      base = parseInt(prices[i].getAttribute("data-base"), 10);
      if (base > 0) prices[i].textContent = formatPrice(commitPrice(base));
    }
    var notes = document.querySelectorAll("[data-note-base]");
    for (i = 0; i < notes.length; i++) {
      base = parseInt(notes[i].getAttribute("data-note-base"), 10);
      if (base > 0) {
        notes[i].textContent = "HT · " + commitSaving(base) + (m.f === 1 ? "" : " · engagement " + commitMode + " mois");
      }
    }
    var btns = document.querySelectorAll("[data-commit-btn]");
    for (i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-commit-btn") === commitMode;
      btns[i].classList.toggle("is-active", on);
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
    var readout = document.querySelectorAll(".cs-readout");
    for (i = 0; i < readout.length; i++) readout[i].textContent = m.label;
    document.documentElement.setAttribute("data-commit", commitMode);
    builderUpdate();
  }

  function setCommit(mode) {
    commitMode = COMMIT_MODES[mode] ? mode : "none";
    applyCommit();
    try {
      document.dispatchEvent(new CustomEvent("ga:commit", { detail: { mode: commitMode } }));
    } catch (e) { /* CustomEvent indisponible : la page fonctionne quand meme */ }
  }

  function recommend(keys) {
    var totalH = 0, seen = {}, list = [], i, k, p;
    keys = keys || [];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      p = PRESTATIONS[k];
      if (!p) continue;
      totalH += p.h;
      seen[p.g] = true;
      list.push(k);
    }

    if (!totalH) {
      return {
        time: "≈ 0 h / mois",
        price: "—",
        markup: false,
        note: "Cochez une ou plusieurs prestations : nous estimons le temps nécessaire et la formule la plus adaptée."
      };
    }

    var scope = "admin";
    if (seen.projet || seen.marches) scope = seen.projet ? "projet" : "marches";
    else if (seen.visib) scope = "visib";
    else if (seen.secre) scope = list.length === 1 ? "secre" : "admin";

    var time = "≈ " + totalH + " h / mois";
    var pool = POOLS[scope] || [];

    if (!pool.length) {
      return {
        time: time,
        price: "Sur devis",
        markup: false,
        note: scope === "marches"
          ? "Appels d'offres facturés à la mission : <strong>290 €</strong> l'analyse et la réponse, <strong>450 €</strong> le dossier complet, ou <strong>890 € / mois</strong> en illimité."
          : "Prestation ponctuelle : <strong>site vitrine 990 €</strong>, <strong>WhatsApp Business et stratégie 109 €/h</strong>. <strong>Google Ads</strong> sur devis, budget publicitaire non inclus."
      };
    }

    var tier = null;
    for (i = 0; i < pool.length; i++) {
      if (pool[i].h >= totalH) { tier = pool[i]; break; }
    }

    if (tier) {
      return {
        time: time,
        price: tier.p,
        markup: true,
        note: "Formule adaptée : <strong>" + tier.n + "</strong> · " + tier.h + " h incluses · " +
              formatPrice(Math.round(tier.p * 0.9)) + " en engagement 6 mois, " +
              formatPrice(Math.round(tier.p * 0.8)) + " en engagement 12 mois."
      };
    }

    var last = pool[pool.length - 1];
    var over = totalH - last.h;
    var extra = over * EXTRA_HOUR;
    return {
      time: time,
      price: last.p + extra,
      markup: true,
      note: "Formule <strong>" + last.n + "</strong> (" + last.h + " h incluses) + " + over +
            " h supplémentaires à " + formatPrice(EXTRA_HOUR) + " = " + formatPrice(extra) +
            " · sans engagement, " + formatPrice(last.p + extra) + "."
    };
  }

  window.GA = {
    PRESTATIONS: PRESTATIONS,
    POOLS: POOLS,
    EXTRA_HOUR: EXTRA_HOUR,
    formatPrice: formatPrice,
    recommend: recommend,
    setCommit: setCommit,
    commitPrice: commitPrice,
    commitWord: commitWord
  };

  var builderTime = $("#bresult-time");
  var builderPrice = $("#bresult-price");
  var builderNote = $("#bresult-note");
  var builderBoxes = Array.prototype.slice.call(document.querySelectorAll(".bitem input[data-b]"));

  function builderUpdate() {
    if (!builderTime || !builderPrice || !builderNote) return;
    var keys = [], i, cb;
    for (i = 0; i < builderBoxes.length; i++) {
      cb = builderBoxes[i];
      if (cb.checked) keys.push(cb.getAttribute("data-b"));
    }
    var r = recommend(keys);
    builderTime.textContent = r.time;
    if (r.markup) {
      builderPrice.innerHTML = "<span id='builderPriceNum'>" + formatPrice(commitPrice(r.price)) +
        "</span><small> / mois HT</small>";
      builderNote.innerHTML = r.note + "<br><span class='bresult-commit'>" + COMMIT_MODES[commitMode].label +
        " · " + commitSaving(r.price) + ".</span>";
    } else {
      builderPrice.innerHTML = r.price;
      builderNote.innerHTML = r.note;
    }
  }

  if (builderBoxes.length) {
    builderBoxes.forEach(function (cb) {
      cb.addEventListener("change", function () {
        var lab = cb.closest(".bitem");
        if (lab) lab.classList.toggle("on", cb.checked);
        builderUpdate();
      });
    });
    builderUpdate();
  }

  /* ---------- Boutons d'engagement ---------- */
  var commitBtns = document.querySelectorAll("[data-commit-btn]");
  for (var ci = 0; ci < commitBtns.length; ci++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        setCommit(btn.getAttribute("data-commit-btn"));
      });
    })(commitBtns[ci]);
  }
  applyCommit();

  /* ---------- Formulaires ---------- */
  /* Libelles lisibles des valeurs de <select>, pour que le message
     enregistre dans Supabase soit exploitable tel quel par l'administrateur. */
  var FIELD_LABELS = {
    besoin: "Besoin principal",
    activite: "Activité",
    sujet: "Sujet",
    objet: "Objet",
    entreprise: "Entreprise",
    factures: "Factures par mois",
    appels: "Appels reçus par mois",
    heures: "Heures par mois",
    formule: "Formule souhaitée",
    formule_id: "Formule",
    formule_nom: "Formule",
    services: "Services recherchés"
  };

  function labelForSelect(el) {
    /* Un <select> non renseigne porte l'option vide "Selectionnez..." :
       il ne faut pas enregistrer ce libelle comme une reponse. */
    if (!el.value) return "";
    if (!el.options || !el.selectedIndex) return (el.value || "").trim();
    var sel = el.options[el.selectedIndex];
    return (sel && sel.textContent ? sel.textContent : el.value || "").trim();
  }

  function collectFields(form) {
    var fields = {};
    var lists = {};
    $$("input[name], select[name], textarea[name]", form).forEach(function (el) {
      var name = el.name;
      if (!name) return;
      if (el.type === "checkbox" || el.type === "radio") {
        if (!el.checked) return;
        (lists[name] = lists[name] || []).push(el.value);
        return;
      }
      var value = (el.tagName === "SELECT") ? labelForSelect(el) : (el.value || "");
      value = value.trim();
      if (!value) return;
      /* Ne pas ecraser une valeur deja presente : certain formulaires
         declarent deux champs pour la meme information. */
      if (!fields.hasOwnProperty(name)) fields[name] = value;
    });
    Object.keys(lists).forEach(function (name) {
      fields[name] = lists[name].join(", ");
    });
    return fields;
  }

  /* Construit le sujet : les champs a plat, dans un ordre lisible. */
  function buildSubject(f) {
    var parts = [];
    ["besoin", "activite", "sujet", "objet"].forEach(function (k) {
      if (f[k]) parts.push(f[k]);
    });
    if (!parts.length && f.services) parts.push(f.services);
    return parts.join(" - ");
  }

  /* Conserve dans le message TOUT ce qui n'a pas de colonne dediee,
     pour qu'aucune information saisie ne soit perdue. */
  function buildMessage(f, raw) {
    var lines = [];
    var text = (raw || "").trim();
    if (text) lines.push(text);
    var extra = [];
    ["entreprise", "factures", "heures", "appels", "formule", "formule_id", "formule_nom"].forEach(function (k) {
      if (f[k]) extra.push((FIELD_LABELS[k] || k) + " : " + f[k]);
    });
    if (f.services) extra.push(FIELD_LABELS.services + " : " + f.services);
    if (extra.length) lines.push("", "--- Informations complémentaires ---", extra.join("\n"));
    return lines.join("\n");
  }

  function setFormBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy) {
      btn.setAttribute("data-label", btn.textContent);
      btn.disabled = true;
      btn.textContent = "Envoi en cours...";
    } else {
      btn.disabled = false;
      if (btn.getAttribute("data-label")) btn.textContent = btn.getAttribute("data-label");
    }
  }

  function showFormError(form, message) {
    var box = form.querySelector(".form-error");
    if (!box) {
      box = document.createElement("p");
      box.className = "form-error";
      box.setAttribute("role", "alert");
      var legal = form.querySelector(".form-legal");
      if (legal) form.insertBefore(box, legal);
      else form.appendChild(box);
    }
    box.textContent = message;
    box.hidden = false;
    box.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function clearFormError(form) {
    var box = form.querySelector(".form-error");
    if (box) box.hidden = true;
  }

  function initForm(form) {
    var successId = form.getAttribute("data-success");
    var success = successId ? document.getElementById(successId) : null;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearFormError(form);
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var f = collectFields(form);
      var payload = {
        name: f.nom || f.prenom || f.name || "",
        email: f.email || "",
        phone: f.telephone || f.tel || f.phone || "",
        subject: buildSubject(f),
        message: buildMessage(f, f.message || f.msg || ""),
        page: f.page || document.title || "",
        formula: f.formule_id || f.formule || f.formule_nom || ""
      };
      function fail(msg) {
        setFormBusy(form, false);
        showFormError(form, msg);
      }
      function done() {
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      if (!(window.GAB && window.GAB.lead)) {
        /* Aucun backend configure : on ne pretend pas avoir enregistre. */
        fail("L'envoi n'est pas disponible pour le moment. Veuillez réessayer plus tard.");
        return;
      }
      setFormBusy(form, true);
      var p;
      try {
        p = window.GAB.lead.submit(payload);
      } catch (err) {
        fail("L'envoi a échoué. Veuillez réessayer dans un instant.");
        return;
      }
      Promise.resolve(p).then(function (res) {
        /* On ne confirme que si l'insertion a reussi. */
        if (res && res.error) {
          fail("Votre message n'a pas pu être enregistré. Veuillez réessayer dans un instant.");
          return;
        }
        done();
      })["catch"](function () {
        fail("Votre message n'a pas pu être enregistré. Veuillez réessayer dans un instant.");
      });
    });
  }
  $$("form.js-form").forEach(initForm);

  /* ---------- Modales legales ---------- */
  var modals = $$(".modal");
  var modalOpener = null;
  var currentModal = null;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusablesIn(m) {
    return $$(FOCUSABLE, m).filter(function (el) {
      if (el.hasAttribute("hidden")) return false;
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }

  /* Piège de focus : sans lui, la touche Tab finit par sortir de la modale
     et par tabuler dans la page derrière, ce qui casse la lecture au
     clavier comme avec un lecteur d'écran. */
  function trapFocus(e, m) {
    /* Échap ferme toujours la modale : sans issue, le piège de focus
       deviendrait un piège de clavier. */
    if (e.key === "Escape") {
      closeModal(m);
      return;
    }
    if (e.key !== "Tab") return;
    var list = focusablesIn(m);
    if (!list.length) { e.preventDefault(); return; }
    var first = list[0];
    var last = list[list.length - 1];
    var active = document.activeElement;
    if (e.shiftKey && (active === first || !m.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !m.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  function openModal(id, opener) {
    var m = $(id);
    if (!m) return;
    /* On mémorise le point de retour explicitement quand on le connaît.
       Se fier à document.activeElement est fragile : refermer une modale
       renvoie le focus sur <body>, ce qui écraserait le point de retour. */
    if (opener) {
      modalOpener = opener;
    } else if (!currentModal) {
      modalOpener = document.activeElement;
    }
    currentModal = m;
    m.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = $(".modal-close", m);
    if (closeBtn) closeBtn.focus();
    m.addEventListener("keydown", function (e) { trapFocus(e, m); });
  }
  function closeModal(m) {
    m.hidden = true;
    document.body.style.overflow = "";
    if (currentModal === m) currentModal = null;
    /* Rendre le focus au lien qui a ouvert la modale. */
    if (modalOpener && document.contains(modalOpener) && typeof modalOpener.focus === "function") {
      modalOpener.focus();
    }
    modalOpener = null;
  }
  function closeAllModals() {
    modals.forEach(function (m) { m.hidden = true; });
    document.body.style.overflow = "";
    currentModal = null;
  }
  $$("[data-modal]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      closeAllModals();
      openModal("#modal-" + link.getAttribute("data-modal"), link);
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

/* ---------- Paiement des formules (Stripe) ---------- */
  var STRIPE_KEYS = {
    "f-essentiel": "essentiel",
    "f-confort": "confort",
    "f-pro": "pro",
    "f-visibilite": "visibilite",
    "f-visibilite-plus": "visibilite_plus",
    "f-developpement": "developpement"
  };
  var modalEls = $$(".modal[id^='modal-f-']");
  modalEls.forEach(function (m) {
    var key = m.id.replace("modal-", "");
    var formula = STRIPE_KEYS[key] || key;
    var link = window.GAB && window.GAB.order ? window.GAB.order.link(formula) : "";
    if (!link) return;
    var cta = m.querySelector(".btn-primary");
    if (!cta) return;
    var btn = document.createElement("a");
    btn.href = link;
    btn.target = "_blank";
    btn.rel = "noopener";
    btn.className = "btn btn-primary";
    btn.style.marginTop = "8px";
    btn.textContent = "Commander - p" + "\u0061" + "iement s" + "\u00e9" + "curis" + "\u00e9";
    btn.addEventListener("click", function () {
      if (window.GAB && window.GAB.order) {
        window.GAB.order.start(formula, (window.GAB.auth && window.GAB.auth.currentUser) ? (window.GAB.auth.currentUser().email || "") : "");
      }
    });
    cta.insertAdjacentElement("afterend", btn);
  });

  /* ---------- Retour de paiement Stripe ---------- */
  (function checkStripeReturn() {
    if (!window.location) return;
    var q = window.location.search + window.location.hash;
    if (q.indexOf("success") < 0) return;
    if (q.indexOf("cancel") >= 0 || q.indexOf("cancelled") >= 0) return;
    var note = "Commande prise en compte - merci de votre confiance ! Nous vous contactons rapidement.";
    document.addEventListener("DOMContentLoaded", function () {
      var bar = document.createElement("div");
      bar.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;background:#1b9d57;color:#fff;text-align:center;padding:12px 16px;font:600 15px/1.4 inherit;box-shadow:0 2px 10px rgba(0,0,0,.25);";
      bar.textContent = note;
      document.body.appendChild(bar);
      setTimeout(function () { bar.style.transition = "opacity .6s"; bar.style.opacity = "0"; }, 5000);
      setTimeout(function () { bar.parentNode && bar.parentNode.removeChild(bar); }, 5700);
      try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
    });
  })();

})();