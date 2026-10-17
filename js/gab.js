/* ============================================================
   GestAffaires - Pont cloud (Supabase Auth + Postgres)
   Fournit une API unique GAB :
     - GAB.config       : configuration (remplie par js/config.js)
     - GAB.listen(evt)  : evenements ("init", "auth-change", "leads")
     - GAB.auth.*        : inscription, connexion, deconnexion, session
     - GAB.data.*        : persistance des cles metier (fallback localStorage)
     - GAB.lead.submit   : envoi des formulaires contact vers la table leads
     - GAB.order.start   : demarrage d'un paiement Stripe + enregistrement
   En l'absence de configuration Supabase, le site reste 100 % fonctionnel
   en mode local (localStorage) : chaque fonction se comporte en secours.
   ============================================================ */
(function () {
  "use strict";

  var LS_MODE = "ga_cloud_mode";     // "local" | "supabase"
  var LS_PENDING = "ga_pending_admin_code";
  var LS_SYNCQ = "ga_sync_queue";    // operations cloud en attente (reprise apres rechargement)

  var conf = (window.GA_CONFIG && window.GA_CONFIG.supabase) || null;
  var stripeLinks = (window.GA_CONFIG && window.GA_CONFIG.stripe) || null;
  var adminCode = (window.GA_CONFIG && window.GA_CONFIG.adminCode) || "";
  var supabase = null;
  var session = null;
  var ready = false;

  var URL_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  /* Cles metier connues du workspace (rafraichies depuis le cloud). */
  var BIZ_KEYS = [
    "ga_clients", "ga_factures", "ga_devis", "ga_contrats", "ga_seq",
    "ga_relances", "ga_depenses", "ga_echeances", "ga_documents", "ga_heures",
    "ga_planif", "ga_prospects", "ga_campagnes", "ga_appels", "ga_rdv",
    "ga_ia", "ga_ws"
  ];

  function emit(evt, detail) {
    if (typeof document === "undefined") return;
    document.dispatchEvent(new CustomEvent("gab:" + evt, { detail: detail || null }));
  }
  function listen(evt, fn) {
    if (typeof document === "undefined") return function () {};
    document.addEventListener("gab:" + evt, function (e) { fn(e.detail); });
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error("Impossible de charger " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------------
     MODE
     ------------------------------------------------------------ */
  function configured() { return !!(conf && conf.url && conf.anonKey); }
  function getMode() {
    try { return localStorage.getItem(LS_MODE) || "local"; } catch (e) { return "local"; }
  }
  function setMode(m) {
    try { localStorage.setItem(LS_MODE, m === "supabase" ? "supabase" : "local"); } catch (e) {}
    emit("mode-change", m);
  }
  function isCloud() { return configured() && getMode() === "supabase" && !!supabase; }

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */
  function init() {
    if (!configured()) {
      ready = true;
      emit("init", { mode: "local", reason: "no-config" });
      return Promise.resolve();
    }
    return loadScript(URL_CDN).then(function () {
      if (!window.supabase) throw new Error("supabase-js indisponible");
      supabase = window.supabase.createClient(conf.url, conf.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      /* Lien "mot de passe oublie" : Supabase emet PASSWORD_RECOVERY quand
         l'utilisateur revient avec le jeton de recuperation dans l'URL. */
      supabase.auth.onAuthStateChange(function (event) {
        if (event === "PASSWORD_RECOVERY") emit("password-recovery", null);
      });
      return supabase.auth.getSession();
    }).then(function (res) {
      session = (res && res.data && res.data.session) || null;
      try { localStorage.setItem(LS_MODE, session ? "supabase" : "local"); } catch (e) {}
      if (session) {
        syncRole().then(function () {
          setLocalSession(session.user);
          ready = true;
          emit("init", { mode: "supabase" });
          emit("auth-change", session.user);
          /* Reprend les ecritures restees en attente, puis remonte en base
             les donnees locales absentes du cloud (migration silencieuse). */
          resumeQueue();
          migrateLocalToCloud();
        });
        return;
      }
      ready = true;
      emit("init", { mode: "local" });
      emit("auth-change", null);
    }).catch(function (err) {
      try { localStorage.setItem(LS_MODE, "local"); } catch (e) {}
      ready = true;
      emit("init", { mode: "local", reason: "error", error: err && err.message });
    });
  }

  /* ------------------------------------------------------------
     SESSION MIRROR (reste compatible avec app.js / workspace.js)
     ------------------------------------------------------------ */
  function setLocalSession(user) {
    try {
      if (!user) return;
      var users = JSON.parse(localStorage.getItem("ga_users") || "[]");
      var id = user.id;
      var exists = null;
      for (var i = 0; i < users.length; i++) if (users[i].id === id) { exists = users[i]; break; }
      var meta = user.user_metadata || {};
      if (exists) {
        exists.name = meta.name || user.email;
        exists.email = user.email;
        exists.role = meta.role || "client";
      } else {
        users.push({
          id: id,
          name: meta.name || user.email,
          login: meta.login || user.email,
          email: user.email,
          pass: "",
          role: meta.role || "client",
          created: new Date().toISOString()
        });
      }
      localStorage.setItem("ga_users", JSON.stringify(users));
      localStorage.setItem("ga_session", JSON.stringify(id))
      try { localStorage.setItem(LS_MODE, "supabase"); } catch (e) {}
    } catch (e) {}
  }
  function clearLocalSession() {
    try {
      localStorage.removeItem("ga_session");
      localStorage.setItem(LS_MODE, "local");
    } catch (e) {}
  }

  /* Efface du navigateur les donnees metier (clients, factures...) et le
     miroir d'utilisateurs quand on quitte un compte cloud. Sur un poste
     partage, l'utilisateur suivant ne peut ainsi pas relire les donnees
     du precedent depuis le cache localStorage. */
  function purgeCloudCache() {
    try { BIZ_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    try { localStorage.removeItem("ga_users"); } catch (e) {}
    dataCache = {};
    /* Ne jamais rejouer les ecritures d'un compte sur le suivant (poste
       partage) : on vide la file d'attente a la deconnexion. */
    pending = Object.create(null);
    try { localStorage.removeItem(LS_SYNCQ); } catch (e) {}
    updateSync();
  }

  function normalizedAuthError(err) {
    var m = (err && (err.message || err.error_description)) || "Une erreur est survenue.";
    m = String(m);
    if (/invalid login credentials/i.test(m)) return { message: "Identifiant ou mot de passe incorrect." };
    if (/already registered/i.test(m)) return { message: "Cet e-mail est deja utilise." };
    if (/password/i.test(m)) return { message: "Le mot de passe doit contenir au moins 6 caracteres." };
    if (/rate limit/i.test(m) || /too many/i.test(m)) return { message: "Trop de tentatives. Patientez quelques minutes." };
    if (/not confirmed/i.test(m)) return { message: "Merci de confirmer votre adresse e-mail grace au lien recu." };
    return { message: "Erreur : " + m };
  }

  function emailByLogin(login) {
    var local = null;
    try {
      var users = JSON.parse(localStorage.getItem("ga_users") || "[]");
      for (var i = 0; i < users.length; i++) {
        if (users[i].login && users[i].login.toLowerCase() === String(login).toLowerCase() && users[i].email) {
          local = users[i].email.toLowerCase();
          break;
        }
      }
    } catch (e) {}
    if (supabase) {
      return supabase.rpc("email_by_login", { p_login: login })
        .then(function (r) { return (r && r.data) || local; })
        .catch(function () { return local; });
    }
    return Promise.resolve(local);
  }

  /* Rafraichit le role local depuis le serveur et applique un code admin
     en attente si besoin. Cote serveur, la RPC claim_admin garantit que
     seul un code connu (hache) et inutilise peut promouvoir. */
  function syncRole() {
    if (!supabase || !session || !session.user) return Promise.resolve();
    var pending = null;
    try { pending = localStorage.getItem(LS_PENDING) || null; } catch (e) {}
    var p;
    if (pending) {
      p = supabase.rpc("claim_admin", { p_code: pending }).then(function (r) {
        return { data: !!(r && r.data) };
      }).catch(function () { return { data: false }; });
    } else {
      p = Promise.resolve({ data: false });
    }
    return p.then(function (claimRes) {
      if (claimRes && claimRes.data) {
        try { localStorage.removeItem(LS_PENDING); } catch (e) {}
      }
      return supabase.rpc("get_my_role").then(function (r) {
        var role = (r && r.data) || "client";
        return supabase.auth.updateUser({ data: { role: role } }).then(function () {
          session.user.user_metadata = session.user.user_metadata || {};
          session.user.user_metadata.role = role;
          setLocalSession(session.user);
          return role;
        }).catch(function () { return role; });
      });
    });
  }

  var auth = {
    available: function () { return !!supabase; },
    currentUser: function () { return (session && session.user) || null; },
    isAdmin: function () {
      var u = session && session.user;
      return !!(u && u.user_metadata && u.user_metadata.role === "admin");
    },
    register: function (opts) {
      var name = String(opts.name || "").trim();
      var login = String(opts.login || "").trim();
      var email = String(opts.email || "").toLowerCase().trim();
      var pass = opts.pass || "";
      var code = String(opts.code || "").trim();
      if (!name || !login || !email || pass.length < 6) {
        return Promise.reject({ message: "Veuillez remplir le nom, l'identifiant, l'e-mail et un mot de passe d'au moins 6 caracteres." });
      }
      var validate = Promise.resolve({ data: true });
      if (code !== "") {
        validate = supabase.rpc("check_admin_code", { p_code: code }).then(function (r) {
          /* supabase.rpc() ne rejette jamais en cas d'erreur SQL : il
             resout avec { data: null, error: {...} }. Sans ce test, une
             panne de configuration etait affichee comme "code invalide",
             ce qui envoyait l'utilisateur verifier son code alors que
             le probleme etait ailleurs. */
          if (r && r.error) {
            throw {
              message: "Verification du code impossible (" +
                ((r.error.message || "erreur serveur").replace(/^.*?\]/s, "").trim()) +
                "). Reessayez dans un instant, ou verifiez que la fonction check_admin_code existe en base."
            };
          }
          if (!(r && r.data)) {
            throw {
              message: "Le code d'inscription est invalide. Deux causes possibles : " +
                "le code n'a pas ete enregistre en base, ou un compte administrateur " +
                "existe deja (le code n'est alors plus accepte)."
            };
          }
          return r;
        });
      }
      return validate.then(function () {
        return supabase.auth.signUp({
          email: email,
          password: pass,
          options: { data: { name: name, login: login } }
        });
      }).then(function (res) {
        var user = (res && res.data && res.data.user) || null;
        var rerr = (res && res.error) || null;
        /* Supabase masque volontairement l'existence d'un compte : si
           l'adresse est deja enregistree, signUp repond { user: null }
           SANS detailing l'erreur. Sans ce test, le site affichait
           "verifiez votre boite e-mail" alors qu'aucun e-mail n'a
           jamais ete envoye, et l'utilisateur restait bloque. */
        if (rerr) {
          if (/already|registered|existe|already been/i.test(rerr.message || "")) {
            throw { message: "Un compte existe deja avec cet e-mail. Connectez-vous plutot que de creer un compte." };
          }
          throw normalizedAuthError(rerr);
        }
        if (!user) {
          if (code !== "") {
            try { localStorage.setItem(LS_PENDING, code); } catch (e) {}
          }
          emit("auth-change", null);
          return { pending: true, email: email };
        }
        session = (res && res.data && res.data.session) || null;
        if (code !== "") {
          try { localStorage.setItem(LS_PENDING, code); } catch (e) {}
        }
        return syncRole().then(function () {
          emit("auth-change", user);
          return { pending: false, user: user };
        });
      }).catch(function (err) {
        throw normalizedAuthError(err);
      });
    },
    login: function (loginOrEmail, pass) {
      var v = String(loginOrEmail || "").toLowerCase().trim();
      function go(email) {
        return supabase.auth.signInWithPassword({ email: email, password: pass })
          .then(function (res) {
            var u = (res && res.data && res.data.user) || null;
            if (!u) throw { message: "Identifiant ou mot de passe incorrect." };
            session = (res && res.data && res.data.session) || null;
            return syncRole().then(function () {
              emit("auth-change", u);
              return u;
            });
          })
          .catch(function (err) { throw normalizedAuthError(err); });
      }
      if (v.indexOf("@") === -1) {
        return emailByLogin(v).then(function (email) {
          if (!email) throw { message: "Identifiant ou mot de passe incorrect." };
          return go(email);
        }).catch(function (err) { throw normalizedAuthError(err); });
      }
      return go(v);
    },
    resetPassword: function (email) {
      if (!supabase) return Promise.reject({ message: "Réinitialisation indisponible (mode local)." });
      var redirect = window.location.origin + window.location.pathname;
      return supabase.auth.resetPasswordForEmail(String(email || "").trim(), { redirectTo: redirect })
        .then(function (res) {
          if (res && res.error) throw normalizedAuthError(res.error);
          return true;
        });
    },
    updatePassword: function (newPass) {
      if (!supabase) return Promise.reject({ message: "Réinitialisation indisponible (mode local)." });
      if (!newPass || String(newPass).length < 6) {
        return Promise.reject({ message: "Le mot de passe doit contenir au moins 6 caractères." });
      }
      return supabase.auth.updateUser({ password: newPass })
        .then(function (res) {
          if (res && res.error) throw normalizedAuthError(res.error);
          return true;
        });
    },
    logout: function () {
      if (!supabase) return Promise.resolve();
      return supabase.auth.signOut().then(function () {
        session = null;
        purgeCloudCache();
        clearLocalSession();
        emit("auth-change", null);
      });
    }
  };

  /* ------------------------------------------------------------
     DATA
     ------------------------------------------------------------ */
  var dataCache = {};

  function localGet(key, def) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return def;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    } catch (e) { return def; }
  }
  function localSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  /* ============================================================
     SYNCHRONISATION CLOUD (file d'attente + reprise + etat)
     ------------------------------------------------------------
     Avant : save() ecrivait en local et lancait l'ecriture cloud sans
     jamais attendre le resultat ni signaler un echec -> un client saisi
     hors ligne n'arrivait jamais sur l'autre poste.
     Desormais : chaque ecriture entre dans une file. La file est poussee
     vers Supabase, reessayee avec un delai croissant, reprise apres un
     rechargement, et son etat est diffuse via l'evenement "gab:sync".
     ============================================================ */
  var pending = Object.create(null);   // key -> { val, del }
  var flushing = false;
  var retryTimer = null;
  var retryDelay = 3000;
  var lastSyncError = null;

  function pendingCount() { return Object.keys(pending).length; }
  function syncState() {
    if (!isCloud()) return "local";
    return pendingCount() > 0 ? "pending" : "synced";
  }
  function updateSync() {
    emit("sync", { state: syncState(), pending: pendingCount(), error: lastSyncError || null });
  }
  function persistQueue() {
    try { localStorage.setItem(LS_SYNCQ, JSON.stringify(pending)); } catch (e) {}
  }
  function resumeQueue() {
    try {
      var raw = localStorage.getItem(LS_SYNCQ);
      if (!raw) return;
      var q = JSON.parse(raw);
      Object.keys(q).forEach(function (k) { if (!pending.hasOwnProperty(k)) pending[k] = q[k]; });
      updateSync();
    } catch (e) {}
  }

  function cloudUpsert(key, val) {
    if (!isCloud()) return Promise.reject(new Error("mode local : cloud indisponible"));
    return supabase.rpc("upsert_app_data", { p_key: key, p_payload: val }).then(function (res) {
      if (res && res.error) throw new Error(res.error.message || "echec de synchronisation");
      return true;
    });
  }
  function cloudDelete(key) {
    if (!isCloud()) return Promise.reject(new Error("mode local : cloud indisponible"));
    return supabase.rpc("delete_app_data", { p_key: key }).then(function (res) {
      if (res && res.error) throw new Error(res.error.message || "echec de suppression");
      return true;
    });
  }

  function scheduleRetry() {
    if (retryTimer || typeof setTimeout === "undefined") return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (pendingCount() === 0) return;
      flush().catch(function () {});
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }

  function flush() {
    if (flushing) return Promise.resolve();
    if (!isCloud() || pendingCount() === 0) { updateSync(); return Promise.resolve(); }
    flushing = true;
    var keys = Object.keys(pending);
    var chain = Promise.resolve();
    keys.forEach(function (k) {
      chain = chain.then(function () {
        if (!pending.hasOwnProperty(k)) return;
        var op = pending[k];
        var call = op.del ? cloudDelete(k) : cloudUpsert(k, op.val);
        return call.then(function () {
          if (pending[k] === op) delete pending[k];
          persistQueue();
        });
      });
    });
    return chain.then(function () {
      flushing = false;
      lastSyncError = null;
      retryDelay = 3000;
      updateSync();
    }).catch(function (err) {
      flushing = false;
      lastSyncError = (err && err.message) || "erreur reseau";
      updateSync();
      scheduleRetry();
      throw err;
    });
  }

  function migrateLocalToCloud() {
    if (!isCloud()) return Promise.resolve({ migrated: 0 });
    return data.refresh().then(function (has) {
      has = has || {};
      var n = 0;
      BIZ_KEYS.forEach(function (k) {
        if (has[k]) return;
        var local = localGet(k, null);
        if (local === null || local === undefined) return;
        if (Array.isArray(local) && local.length === 0) return;
        pending[k] = { val: local, del: false };
        n++;
      });
      if (n) { persistQueue(); updateSync(); }
      return flush().then(function () { return { migrated: n }; });
    }).catch(function () { return { migrated: 0 }; });
  }

  var data = {
    enabled: function () { return isCloud(); },
    setMode: setMode,
    load: function (key, def) {
      if (isCloud()) {
        if (dataCache.hasOwnProperty(key)) return dataCache[key];
        var cached = localGet(key, def);
        dataCache[key] = cached;
        return cached;
      }
      return localGet(key, def);
    },
    save: function (key, val) {
      localSet(key, val);
      dataCache[key] = val;
      if (isCloud()) {
        pending[key] = { val: val, del: false };
        persistQueue();
        updateSync();
        flush().catch(function () {});
      }
    },
    /* Save qui renvoie une promesse (resolue une fois la donnee reellement
       ecrite en base). A utiliser par les modules qui veulent signaler un
       echec. En mode local, rejette : la donnee reste sur cet appareil. */
    saveAsync: function (key, val) {
      localSet(key, val);
      dataCache[key] = val;
      if (!isCloud()) {
        return Promise.reject(new Error("mode local : donnee conservée sur cet appareil uniquement"));
      }
      pending[key] = { val: val, del: false };
      persistQueue();
      updateSync();
      return flush();
    },
    get: function (key) { return data.load(key, []); },
    put: function (key, list) { data.save(key, list); },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
      delete dataCache[key];
      if (isCloud()) {
        pending[key] = { del: true };
        persistQueue();
        updateSync();
        flush().catch(function () {});
      }
    },
    removeAsync: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
      delete dataCache[key];
      if (!isCloud()) return Promise.reject(new Error("mode local : cloud indisponible"));
      pending[key] = { del: true };
      persistQueue();
      updateSync();
      return flush();
    },
    flush: flush,
    migrate: migrateLocalToCloud,
    syncState: syncState,
    pendingCount: function () { return Object.keys(pending).length; },
    flushCache: function () {
      if (!isCloud()) return Promise.resolve();
      Object.keys(dataCache).forEach(function (k) {
        if (BIZ_KEYS.indexOf(k) !== -1) pending[k] = { val: dataCache[k], del: false };
      });
      persistQueue();
      updateSync();
      return flush();
    },
    refresh: function (keys) {
      if (!isCloud()) return Promise.resolve();
      var ks = keys || BIZ_KEYS;
      return supabase.from("app_data").select("key,payload").in("key", ks)
        .then(function (res) {
          if (!res || res.error || !res.data) return null;
          var has = {};
          res.data.forEach(function (row) {
            has[row.key] = true;
            dataCache[row.key] = row.payload;
            localSet(row.key, row.payload);
          });
          return has;
        }).catch(function () { return null; });
    }
  };

  /* ------------------------------------------------------------
     LEADS
     ------------------------------------------------------------ */
  function notifyAdmin(fields) {
    if (!conf || !conf.url) return;
    var base = String(conf.url).replace(/\/+$/, "");
    try {
      fetch(base + "/functions/v1/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": conf.anonKey || "",
          "Authorization": "Bearer " + (conf.anonKey || "")
        },
        body: JSON.stringify({
          name: fields.name || "", email: fields.email || "", phone: fields.phone || "",
          subject: fields.subject || "", message: fields.message || "",
          page: fields.page || "", formula: fields.formula || ""
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function runLead(fields) {
    notifyAdmin(fields);
    if (!supabase) return Promise.resolve({ local: true });
    return supabase.rpc("insert_lead", {
      p_name: fields.name || "", p_email: fields.email || "", p_phone: fields.phone || "",
      p_subject: fields.subject || "", p_message: fields.message || "",
      p_page: fields.page || "", p_formula: fields.formula || ""
    }).then(function (res) {
      emit("leads", fields);
      return (res && res.error) ? { local: false, error: res.error.message } : { local: false };
    }).catch(function (err) {
      emit("leads", fields);
      return { local: true, error: err && err.message };
    });
  }
  var lead = {
    enabled: function () { return !!supabase; },
    submit: function (fields) {
      if (configured() && !supabase) return init().then(function () { return runLead(fields); });
      return runLead(fields);
    }
  };

  /* ------------------------------------------------------------
     ORDERS (Stripe)
     ------------------------------------------------------------ */
  /* Cree une Checkout Session cote serveur (Edge Function stripe-checkout)
     afin que le webhook puisse associer le paiement a la commande sans
     ambiguite. Si la fonction n'est pas disponible (ou Stripe non
     configure), retourne "" : le site bascule sur le Payment Link. */
  function serverCheckout(formula, customer, orderId) {
    if (!conf || !conf.url) return Promise.resolve("");
    var base = String(conf.url).replace(/\/+$/, "");
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 4000) : null;
    return fetch(base + "/functions/v1/stripe-checkout", {
      method: "POST",
      signal: ctrl ? ctrl.signal : undefined,
      headers: {
        "Content-Type": "application/json",
        "apikey": conf.anonKey || "",
        "Authorization": "Bearer " + (conf.anonKey || "")
      },
      body: JSON.stringify({ formula: formula, customer: customer || "", order_id: orderId || null })
    }).then(function (res) {
      if (!res.ok) return "";
      return res.json().then(function (j) { return (j && j.url) || ""; });
    }).catch(function () { return ""; })
      .then(function (u) { if (timer) clearTimeout(timer); return u; });
  }

  var order = {
    link: function (formula) {
      if (!stripeLinks) return "";
      return stripeLinks[formula] || "";
    },
    start: function (formula, customer) {
      var url = order.link(formula);
      if (!url) return Promise.resolve({ url: "" });
      var p = Promise.resolve(null);
      if (isCloud()) {
        p = supabase.rpc("create_order", {
          p_formula: formula, p_customer: customer || "", p_amount: formulaAmount(formula)
        }).then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
      }
      return p.then(function (oid) {
        return serverCheckout(formula, customer, oid).then(function (serverUrl) {
          var finalUrl = serverUrl || url;
          return { url: finalUrl, orderId: oid, go: function () { location.href = finalUrl; } };
        });
      });
    }
  };
  function formulaAmount(key) {
    var M = { essentiel: 350, confort: 600, pro: 1000, visibilite: 690, visibilite_plus: 850, developpement: 1290 };
    return M[key] || 0;
  }

  /* Reprise automatique des ecritures en attente des le retour du reseau
     ou lorsque l'onglet redevient visible (reconnexion d'un poste nomade). */
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", function () { flush().catch(function () {}); });
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") flush().catch(function () {});
      });
    }
  }

  /* ------------------------------------------------------------
     API PUBLIQUE
     ------------------------------------------------------------ */
  window.GAB = {
    configured: configured,
    isCloud: isCloud,
    mode: getMode,
    init: init,
    listen: listen,
    auth: auth,
    data: data,
    lead: lead,
    order: order,
    config: conf,
    adminCode: adminCode,
    BIZ_KEYS: BIZ_KEYS
  };
  Object.defineProperty(window.GAB, "ready", {
    get: function () { return ready; },
    set: function (v) { ready = v; }
  });

  if (typeof window !== "undefined") {
    init();
  }
})();