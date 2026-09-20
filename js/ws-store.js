/* ============================================================
   GestAffaires – Coffre-fort & stockage sécurisé (Nouveau client / dossiers)
   - Pièces jointes chiffrées AES-GCM dans IndexedDB
     (clé dérivée PBKDF2 depuis une phrase secrète, jamais persistée)
   - Sauvegarde .geb entièrement chiffrée (export/import)
     Cloud-ready : le même fichier chiffré pourra partir vers Drive/Cloud
   Ajoute : GW.vault, GW.files, GW.backup
   ============================================================ */

(function (GW) {
  "use strict";

  var META_KEY = "ga_vault_meta";
  var ITERS = 150000;

  var sessionKey = null;
  var salt = null;
  var pwHash = null;

  function enc(s) { return new TextEncoder().encode(s); }
  function b64(buf) {
    var b = new Uint8Array(buf), s = "", i = 0;
    for (; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(s) {
    var raw = atob(s), arr = new Uint8Array(raw.length), i = 0;
    for (; i < arr.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  function metaRead() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch (e) { return {}; }
  }
  function metaWrite(m) {
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {}
  }

  function supported() {
    return !!(window.indexedDB && window.crypto && window.crypto.subtle);
  }

  function deriveKey(pass, saltBytes) {
    return crypto.subtle.importKey("raw", enc(pass), "PBKDF2", false, ["deriveKey"])
      .then(function (mat) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: saltBytes, iterations: ITERS, hash: "SHA-256" },
          mat,
          { name: "AES-GCM", length: 256 },
          false, ["encrypt", "decrypt"]);
      });
  }

  function sha256(s) { return crypto.subtle.digest("SHA-256", enc(s)); }

  /* ------------------- IndexedDB ------------------- */
  function openDB() {
    return new Promise(function (res, rej) {
      try {
        var req = indexedDB.open("gestaffaires-vault", 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
        };
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      } catch (e) { rej(e); }
    });
  }
  function idbGet(store, key) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, "readonly");
        var r = t.objectStore(store).get(key);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbAll(store) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, "readonly");
        var r = t.objectStore(store).getAll();
        r.onsuccess = function () { res(r.result || []); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbPut(store, val) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, "readwrite");
        t.objectStore(store).put(val);
        t.oncomplete = res;
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbPutAll(store, vals) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, "readwrite");
        var st = t.objectStore(store);
        (vals || []).forEach(function (v) { st.put(v); });
        t.oncomplete = res;
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbDel(store, key) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, "readwrite");
        t.objectStore(store).delete(key);
        t.oncomplete = res;
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbClear(store) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, "readwrite");
        t.objectStore(store).clear();
        t.oncomplete = res;
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  /* ------------------- Coffre (vault) ------------------- */
  function initVault(pass) {
    if (!supported()) return Promise.reject(new Error("IndexedDB/WebCrypto indisponible"));
    var m = metaRead();
    if (m.hash) return Promise.reject(new Error("Phrase secrète déjà définie — déverrouillez avec « Développer le coffre »."));
    salt = crypto.getRandomValues(new Uint8Array(16));
    return sha256(pass).then(function (h) {
      var hash = b64(new Uint8Array(h));
      metaWrite({ salt: b64(salt), hash: hash });
      pwHash = hash;
      return deriveKey(pass, salt);
    }).then(function (k) { sessionKey = k; return true; });
  }

  function unlockVault(pass) {
    var m = metaRead();
    if (!m.salt || !m.hash) return Promise.reject(new Error("Aucune phrase secrète définie."));
    return sha256(pass).then(function (h) {
      if (b64(new Uint8Array(h)) !== m.hash) return Promise.reject(new Error("Phrase secrète incorrecte."));
      salt = unb64(m.salt);
      pwHash = m.hash;
      return deriveKey(pass, salt);
    }).then(function (k) { sessionKey = k; return true; });
  }

  function lockVault() { sessionKey = null; }

  function vaultStatus() {
    var m = metaRead();
    return { supported: supported(), configured: !!m.hash, unlocked: !!sessionKey };
  }

  function encData(key, data) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data).then(function (ct) {
      return { iv: b64(iv), data: b64(ct) };
    });
  }
  function decData(key, ivB64, dataB64) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, key, unb64(dataB64));
  }

  /* ------------------- Pièces jointes (files) ------------------- */
  function listFiles(clientId) {
    return idbAll("files").then(function (all) {
      return all.filter(function (f) { return !clientId || f.clientId === clientId; })
        .map(function (f) { return { id: f.id, clientId: f.clientId, name: f.name, type: f.type, size: f.size, ts: f.ts }; })
        .sort(function (a, b) { return b.ts - a.ts; });
    });
  }
  function countFiles(clientId) {
    return listFiles(clientId).then(function (l) { return l.length; });
  }
  function addFile(clientId, file) {
    if (!sessionKey) return Promise.reject(new Error("Coffre verrouillé — déverrouillez pour stocker des pièces jointes."));
    var meta = { id: GW.uid(), clientId: clientId, name: file.name || "fichier", type: file.type || "application/octet-stream", size: file.size || 0, ts: Date.now() };
    return file.arrayBuffer().then(function (buf) { return encData(sessionKey, buf); })
      .then(function (ct) { return idbPut("files", { id: meta.id, clientId: meta.clientId, name: meta.name, type: meta.type, size: meta.size, ts: meta.ts, iv: ct.iv, data: ct.data }); })
      .then(function () { return meta.id; });
  }
  function openFile(id) {
    if (!sessionKey) return Promise.reject(new Error("Coffre verrouillé."));
    return idbGet("files", id).then(function (rec) {
      if (!rec) return null;
      return decData(sessionKey, rec.iv, rec.data).then(function (bytes) {
        return { name: rec.name, type: rec.type, blob: new Blob([bytes], { type: rec.type }), size: rec.size };
      });
    });
  }
  function removeFile(id) { return idbDel("files", id); }

  /* ------------------- Sauvegarde chiffrée (.geb) ------------------- */
  function collectStore() {
    var out = {}, k;
    for (k = 0; k < localStorage.length; k++) {
      var key = localStorage.key(k);
      if (/^(ga_|ws_)/.test(key || "")) { try { out[key] = localStorage.getItem(key); } catch (e) {} }
    }
    return out;
  }
  function backupExport() {
    if (!sessionKey) return Promise.reject(new Error("Coffre verrouillé — déverrouillez avant de sauvegarder."));
    var payload = { app: "gestaffaires", ver: 1, created: new Date().toISOString(), store: collectStore() };
    return idbAll("files").then(function (files) {
      payload.files = files;
      return encData(sessionKey, new TextEncoder().encode(JSON.stringify(payload)));
    }).then(function (ct) {
      var env = { app: "gestaffaires", ver: 1, created: new Date().toISOString(), iv: ct.iv, data: ct.data };
      var blob = new Blob([JSON.stringify(env)], { type: "application/json" });
      var a = document.createElement("a");
      var name = "sauvegarde-gestaffaires-" + GW.today() + ".geb";
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 400);
      return name;
    });
  }
  function backupImport(file, confirmOverwrite) {
    if (!sessionKey) return Promise.reject(new Error("Coffre verrouillé — déverrouillez avant de restaurer."));
    if (!confirmOverwrite) return Promise.reject(new Error("Confirmation requise (écrase les données actuelles)."));
    return file.text().then(function (txt) {
      var env = JSON.parse(txt);
      if (!env || env.app !== "gestaffaires" || !env.data) throw new Error("Fichier .geb invalide.");
      return decData(sessionKey, env.iv, env.data).then(function (bytes) {
        return JSON.parse(new TextDecoder().decode(bytes));
      });
    }).then(function (payload) {
      var lsKeys = Object.keys(payload.store || {});
      var cur = [];
      for (var i = 0; i < localStorage.length; i++) { cur.push(localStorage.key(i)); }
      cur.forEach(function (k) { if (/^(ga_|ws_)/.test(k || "")) try { localStorage.removeItem(k); } catch (e) {} });
      lsKeys.forEach(function (k) { try { localStorage.setItem(k, payload.store[k]); } catch (e) {} });
      return idbClear("files").then(function () { return idbPutAll("files", payload.files || []); });
    }).then(function () { return true; });
  }

  /* ------------------- Jeton ? non : API publique ------------------- */
  GW.vault = {
    init: initVault,
    unlock: unlockVault,
    lock: lockVault,
    status: vaultStatus,
    meta: metaRead
  };
  GW.files = {
    supported: supported,
    list: listFiles,
    count: countFiles,
    add: addFile,
    open: openFile,
    remove: removeFile
  };
  GW.backup = {
    doExport: backupExport,
    doImport: backupImport
  };

  /* ------------------- MODULE « Sécurité & sauvegarde » ------------------- */
  GW.register({
    id: "securite",
    cat: "Centre de pilotage",
    name: "Sécurité & sauvegarde",
    tag: "Coffre chiffré · Clé IA · Sauvegarde .geb",
    icon: "🔐",
    render: function () {
      var vs = vaultStatus();
      var iaCfg = GW.load("ga_ia", {});
      var iaBadge = (iaCfg.key && iaCfg.key.length > 15)
        ? GW.badge("Clé IA configurée (stockée ici uniquement)", "ok")
        : GW.badge("Clé IA à configurer", "warn");
      var vaultHTML;
      if (!vs.supported) {
        vaultHTML = "<p class='ws-hint' style='color:#b3423a;'>IndexedDB/WebCrypto indisponibles — stockage des pièces désactivé.</p>";
      } else if (!vs.configured) {
        vaultHTML = "<div class='ws-form'>" +
          GW.formRow("Créer le coffre — phrase secrète", GW.input("sec_pass", "", "8 caractères minimum (elle n'est jamais stockée en clair)", "type='password'")) +
          "</div><div class='ws-actions'><button class='admin-btn primary' data-sec-init>🔐 Créer le coffre</button></div>" +
          "<p class='ws-hint'>La phrase secrète chiffre les pièces jointes (AES-256). Si vous la perdez, les pièces deviennent illisibles : conservez-la précieusement.</p>";
      } else if (!vs.unlocked) {
        vaultHTML = "<div class='ws-form'>" +
          GW.formRow("Déverrouiller le coffre", GW.input("sec_pass", "", "Phrase secrète", "type='password'")) +
          "</div><div class='ws-actions'><button class='admin-btn primary' data-sec-unlock>🔓 Déverrouiller</button></div>";
      } else {
        vaultHTML = "<p class='ws-hint' style='color:#0b7a46;'>🔓 Coffre déverrouillé pendant cette session.</p>" +
          "<div class='ws-actions'><button class='admin-btn' data-sec-lock>🔒 Verrouiller</button></div>" +
          "<hr style='border:none;border-top:1px solid var(--border,rgba(11,27,51,.12));margin:14px 0;'>" +
          "<h4>Sauvegarde chiffrée (.geb)</h4>" +
          "<p class='ws-hint'>Exporte TOUTES les données (clients, factures, devis, outils) + pièces jointes dans un fichier chiffré. Conservez-le ailleurs (clé USB, cloud) : il est portable et cloud-ready.</p>" +
          "<div class='ws-actions'><button class='admin-btn' data-bk-export>💾 Exporter la sauvegarde</button></div>" +
          "<div style='margin-top:12px;'><input type='file' id='bk-file' accept='.geb' style='max-width:300px;'><label style='margin-left:8px;'><input type='checkbox' id='bk-confirm'> J'écrase les données actuelles</label></div>" +
          "<button class='admin-btn' data-bk-import style='margin-top:10px;'>📥 Restaurer depuis un .geb</button>";
      }
      return "<div class='ws-panel'><h3>Sécurité, clé IA &amp; sauvegarde</h3>" +
        "<div class='ws-form'><div class='ws-frow'><label>Clé API Gemini</label>" + iaBadge +
        "<p class='ws-hint'>Renseignée dans le module « Assistant IA », stockée uniquement dans ce navigateur — jamais dans le code du site, jamais transmise ailleurs que vers Google pour générer du contenu.</p></div></div>" +
        "<hr style='border:none;border-top:1px solid var(--border,rgba(11,27,51,.12));margin:14px 0;'>" +
        "<h4>🔐 Coffre des pièces jointes</h4>" +
        vaultHTML +
        "</div>";
    },
    afterRender: function () {
      var $ = function (s) { return document.querySelector(s); };
      var secInit = $("[data-sec-init]");
      if (secInit) secInit.addEventListener("click", function () {
        var pass = $("[name=sec_pass]");
        if (!pass || pass.value.length < 8) { GW.toast("Phrase secrète : 8 caractères minimum"); return; }
        initVault(pass.value).then(function () { GW.toast("Coffre créé et déverrouillé"); GW.render(); })
          .catch(function (e) { GW.toast(e.message); });
      });
      var secUn = $("[data-sec-unlock]");
      if (secUn) secUn.addEventListener("click", function () {
        var pass = $("[name=sec_pass]");
        if (!pass || !pass.value) { GW.toast("Saisissez la phrase secrète"); return; }
        unlockVault(pass.value).then(function () { GW.toast("Coffre déverrouillé"); GW.render(); })
          .catch(function (e) { GW.toast(e.message); });
      });
      var secLock = $("[data-sec-lock]");
      if (secLock) secLock.addEventListener("click", function () { lockVault(); GW.toast("Coffre verrouillé"); GW.render(); });
      var bkExport = $("[data-bk-export]");
      if (bkExport) bkExport.addEventListener("click", function () {
        bkExport.disabled = true;
        backupExport().then(function (name) { GW.toast("Sauvegarde " + name + " téléchargée"); })
          .catch(function (e) { GW.toast(e.message); })
          .then(function () { bkExport.disabled = false; });
      });
      var bkImport = $("[data-bk-import]");
      if (bkImport) bkImport.addEventListener("click", function () {
        var f = $("#bk-file");
        var ok = $("#bk-confirm");
        if (!f || !f.files || !f.files.length) { GW.toast("Choisissez un fichier .geb"); return; }
        backupImport(f.files[0], !!(ok && ok.checked)).then(function () {
          GW.toast("Données restaurées"); GW.render(); if (GW.goHome) GW.goHome();
        }).catch(function (e) { GW.toast(e.message); });
      });
    }
  });
}(window.GestWorkspace));