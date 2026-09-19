/* ============================================================
   GestAffaires – Espace de travail
   Suite d'outils automatisés pour l'administrateur :
   1. Gestion administrative      6. Google Ads
   2. Google Business Profile     7. Suivi des campagnes
   3. Réseaux sociaux             8. Reporting
   4. Création de contenus        9. Accompagnement stratégique
   5. SEO local
   Génération 100 % locale (règles + modèles), démo sans backend.
   Données conservées dans le navigateur (localStorage "ga_tools").
   ============================================================ */

window.GestWorkspace = (function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var LS_TOOLS = "ga_tools";
  var LS_CLIENTS = "ga_clients";
  var LS_FACTURES = "ga_factures";
  var LS_DEVIS = "ga_devis";
  var LS_CONTRATS = "ga_contrats";

  var adminMain = function () { return $("#admin-main"); };
  var activeTool = null;
  var currentInputs = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }
  function load(key, def) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function getTools() { return load(LS_TOOLS, {}); }
  function setTools(t) { save(LS_TOOLS, t); }
  function today() {
    var d = new Date(), m = String(d.getMonth() + 1).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    try { return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR"); } catch (e) { return iso; }
  }

  /* ------------------------------------------------------------------
     Cadre de page ("entête + pied") réutilisé par tous les onglets
     ------------------------------------------------------------------ */
  function pageHead(title, sub) {
    return '<div class="admin-head"><div><h2>' + esc(title) + "</h2><p>" + esc(sub) + '</p></div>' +
      '<a class="admin-btn admin-btn-ghost" href="#" data-ws-home>← Espace de travail</a></div>';
  }
  function card(inner) {
    return '<div class="admin-card ws-card">' + inner + "</div>";
  }

  /* ------------------------------------------------------------------
     USINE À FORMULAIRES
     fields = [ { n, label, type, options, ph, hint } ]
     ------------------------------------------------------------------ */
  function fieldHTML(f) {
    var n = f.n, lab = f.label || "";
    var req = f.req ? " required" : "";
    var v = esc(currentInputs[n] != null ? currentInputs[n] : (f.def || ""));
    if (f.type === "select") {
      var opts = (f.options || []).map(function (o) {
        return '<option value="' + esc(o) + '"' + (String(currentInputs[n] === o || (v === o)) ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("");
      return '<div class="form-field"><label>' + esc(lab) + "</label><select name=\"" + n + "\"" + req + ">" + opts + "</select>" + (f.hint ? '<p class="ws-hint">' + esc(f.hint) + "</p>" : "") + "</div>";
    }
    if (f.type === "textarea") {
      return '<div class="form-field"><label>' + esc(lab) + "</label><textarea name=\"" + n + "\" rows=\"" + (f.rows || 3) + "\"" + req + ">" + v + "</textarea>" + (f.hint ? '<p class="ws-hint">' + esc(f.hint) + "</p>" : "") + "</div>";
    }
    return '<div class="form-field"><label>' + esc(lab) + "</label><input name=\"" + n + "\" type=\"" + (f.type || "text") + "\" value=\"" + v + "\"" + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : "") + req + ">" + (f.hint ? '<p class="ws-hint">' + esc(f.hint) + "</p>" : "") + "</div>";
  }
  function collectFields(form, fields) {
    var out = {};
    fields.forEach(function (f) {
      var el = form.querySelector('[name="' + f.n + '"]');
      out[f.n] = el ? el.value.trim() : "";
    });
    return out;
  }

  /* ------------------------------------------------------------------
     SAVEGARDE historiques par outil
     ------------------------------------------------------------------ */
  function history(id) { return (getTools()[id] || []); }
  function pushHistory(id, entry) {
    var t = getTools();
    (t[id] = t[id] || []).unshift(entry);
    setTools(t);
  }
  function removeHistory(id, index) {
    var t = getTools();
    if (t[id]) t[id].splice(index, 1);
    setTools(t);
  }

  /* ==================================================================
     OUTILS (définition)
     ================================================================== */
  var TOOLS = [];

  /* ---------- 1. Gestion administrative ---------- */
  TOOLS.push({
    id: "admin",
    name: "Gestion administrative",
    desc: "Déposez vos informations et documents : l'assistant classe, génère votre calendrier d'échéances et votre carnet administratif.",
    icon: "🗂️",
    fields: [
      { n: "societe", label: "Nom de la société", type: "text", req: true, ph: "Ma société" },
      { n: "forme", label: "Forme juridique", type: "select", options: ["Auto-entrepreneur", "EURL", "SARL", "SASU", "SAS", "EI"], def: "Auto-entrepreneur" },
      { n: "siret", label: "SIRET / RCS (optionnel)", type: "text", ph: "000 000 000 00000" },
      { n: "comptable", label: "Votre cabinet comptable", type: "text", ph: "Nom ou e-mail du comptable" },
      { n: "tva", label: "Régime TVA", type: "select", options: ["Micro-BIC (pas de TVA)", "Franchise en base", "Réel simplifié", "Réel normal"], def: "Micro-BIC (pas de TVA)" },
      { n: "documents", label: "Documents que vous possédez (un par ligne)", type: "textarea", rows: 4, ph: "KBIS / extrait RCS\nAssurance RC Pro (échéance), Attestation URSSAF…" }
    ],
    generate: function (v) {
      var docLines = (v.documents || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var classified = {
        Juridique: ["KBIS", "STATUTS", "RCS", "GREFFE", "PV", "REGISTRE"],
        Fiscal: ["TVA", "IMPÔT", "IR", "IS", "BIC", "RESULTAT", "DGFIP"],
        Social: ["URSSAF", "ATTESTATION", "PAIE", "SALAIRE", "MDPH", "PATRONAL"],
        Assurance: ["ASSURANCE", "RC PRO", "MULTIRISQUE", "RECOURS"],
        Bancaire: ["BANQUE", "RIB", "CREDIT", "CONTRAT BANCAIRE"],
        Commercial: ["FACTURE", "DEVIS", "CONTRAT", "CLIENT", "SOCIETE.COM"]
      };
      function findCat(name) {
        var up = (name || "").toUpperCase();
        for (var k in classified) {
          if (classified[k].some(function (kw) { return up.indexOf(kw) !== -1; })) return k;
        }
        return "Divers";
      }
      var groups = {};
      docLines.forEach(function (d) {
        var c = findCat(d);
        (groups[c] = groups[c] || []).push(d);
      });
      var docList = docLines.length
        ? Object.keys(groups).map(function (g) {
            return "<tr><td><b>" + esc(g) + "</b></td><td>" + groups[g].map(esc).join(" ; ") + "</td></tr>";
          }).join("")
        : '<tr><td colspan="2" class="empty-note">Aucun document saisi.</td></tr>';

      var reminders = [];
      var y = new Date().getFullYear();
      if (v.tva.indexOf("Réel") !== -1) {
        ["CA trimestriel (déclaration de TVA)", "CA trimestriel (déclaration de TVA)", "CA trimestriel (déclaration de TVA)", "CA trimestriel (déclaration de TVA)"].forEach(function (r, i) {
          reminders.push("<li>" + r + " – à remettre ~" + fmtDate(String(y) + "-0" + (i * 3 + 2) + "-15") + "</li>");
        });
      } else {
        reminders.push("<li>CA annuel (déclaration de revenus) – ~" + fmtDate(String(y) + "-05-05") + "</li>");
      }
      reminders.push("<li>URSSAF : prélèvement mensuel (si mensualisé) – chèque de trésorerie chaque mois</li>");
      if (v.comptable) reminders.push("<li>Remise de pièces comptables à " + esc(v.comptable) + " – avant le 5 du mois suivant</li>");

      return card(
        "<h3>Dossier administratif de <b>" + esc(v.societe) + "</b></h3>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>📋 Documents classés automatiquement</h4><table class="admin-table"><thead><tr><th>Catégorie</th><th>Documents</th></tr></thead><tbody>' + docList + "</tbody></table></div>" +
        '<div class="ws-box"><h4>⏰ Échéances à suivre</h4><ul class="ws-list">' + reminders.join("") + "</ul>" +
        "<h4>🔖 Fiche société</h4><ul class='ws-list'>" +
        "<li><b>Forme</b> : " + esc(v.forme) + "</li>" +
        (v.siret ? "<li><b>SIRET</b> : " + esc(v.siret) + "</li>" : "") +
        (v.comptable ? "<li><b>Comptable</b> : " + esc(v.comptable) + "</li>" : "") +
        "<li><b>TVA</b> : " + esc(v.tva) + "</li></ul></div></div>"
      );
    }
  });

  /* ---------- 2. Google Business Profile ---------- */
  TOOLS.push({
    id: "gbp",
    name: "Google Business Profile",
    desc: "Indiquez vos informations : l'assistant génère votre fiche Google optimisée (description, services, horaires) et la checklist de mise en ligne.",
    icon: "📍",
    fields: [
      { n: "entreprise", label: "Nom de l'entreprise", type: "text", req: true },
      { n: "categorie", label: "Catégorie principale", type: "text", req: true, ph: "ex : Agence de marketing digital" },
      { n: "ville", label: "Ville", type: "text", req: true },
      { n: "adresse", label: "Adresse (ou zone d'intervention)", type: "text" },
      { n: "telephone", label: "Téléphone", type: "tel" },
      { n: "site", label: "Site web", type: "text", ph: "https://…" },
      { n: "horaires", label: "Horaires", type: "text", def: "Lun–Ven 9h–18h" },
      { n: "services", label: "Vos services (un par ligne)", type: "textarea", rows: 3, ph: "Création de sites web\nGoogle Business Profile\nRéseaux sociaux" }
    ],
    generate: function (v) {
      var services = (v.services || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var desc = v.entreprise + " est une " + v.categorie + " basée " + (v.ville ? "à " + v.ville : "en ligne") + ". " +
        (services.length ? "Nous accompagnons les entreprises au quotidien : " + services.join(", ") + ". " : "") +
        "Un accompagnement personnalisé, des résultats mesurables et un service proche de vous. " +
        (v.telephone ? "Contactez-nous au " + v.telephone + " " : "") +
        (v.site ? "ou via notre site " + v.site + ". " : "") +
        (v.adresse ? "Nous intervenons au " + v.adresse + ". " : "") +
        "Réponse rapide, devis gratuit et conseils adaptés à votre activité.";
      var svcList = services.length
        ? services.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("")
        : "<li>Aucun service saisi.</li>";
      return card(
        "<h3>Fiche Google Business Profile de <b>" + esc(v.entreprise) + "</b></h3>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>✍️ Description optimisée (prête à coller)</h4><p class="ws-quote">' + esc(desc) + "</p>" +
        "<h4>Services affichés</h4><ul class='ws-list'>" + svcList + "</ul></div>" +
        '<div class="ws-box"><h4>✅ Checklist de mise en ligne</h4><ul class="ws-list ws-check">' +
        "<li>Créer/revendiquer la fiche sur business.google.com</li>" +
        "<li>Choisir la catégorie <b>" + esc(v.categorie) + "</b></li>" +
        (v.ville ? "<li>Zone de service : <b>" + esc(v.ville) + "</b></li>" : "") +
        (v.telephone ? "<li>Téléphone confirmé : <b>" + esc(v.telephone) + "</b></li>" : "") +
        (v.site ? "<li>Lien du site : <b>" + esc(v.site) + "</b></li>" : "") +
        "<li>Horaires renseignés : <b>" + esc(v.horaires) + "</b></li>" +
        "<li>Téléverser 3 à 5 photos de qualité (atelier, équipe, réalisations)</li>" +
        "<li>Demander la vérification Google (carte postale / vidéo)</li>" +
        "<li>Rédiger la réponse type aux avis (voir bouton Recommandations)</li></ul></div></div>"
      );
    }
  });

  /* ---------- 3. Réseaux sociaux ---------- */
  TOOLS.push({
    id: "social",
    name: "Réseaux sociaux",
    desc: "Vos accès, votre thème, vos photos : l'assistant génère bios, calendrier éditorial et publications prêtes à poster.",
    icon: "📱",
    fields: [
      { n: "entreprise", label: "Nom de l'entreprise", type: "text", req: true },
      { n: "plateformes", label: "Plateformes visées", type: "select", options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "Toutes"], def: "Instagram" },
      { n: "theme", label: "Thème / style visuel", type: "text", ph: "ex : moderne, minimaliste, chaleureux" },
      { n: "tons", label: "Ton de communication", type: "select", options: ["Professionnel", "Décontracté", "Pédagogue", "Engagé", "Ludique"], def: "Professionnel" },
      { n: "sujets", label: "3 sujets à mettre en avant (un par ligne)", type: "textarea", rows: 3, ph: "Nos réalisations\nConseils en gestion\nOffres du moment" },
      { n: "public", label: "Public cible", type: "text", ph: "ex : dirigeants de PME" }
    ],
    generate: function (v) {
      var sujets = (v.sujets || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var hashtags = ["#" + (v.entreprise || "entreprise").replace(/\s+/g, ""), "#GestAffaires", "#Digital", "#Gestion", "#MarketingDigital"].join(" ");
      var comments = {
        Professionnel: "🤝 Faites confiance à une approche sérieuse et mesurable.",
        Décontracté: "😎 Simple, efficace, et sans prise de tête.",
        Pédagogue: "💡 On vous explique tout en toute transparence.",
        Engagé: "🌍 Une démarche locale et responsable.",
        Ludique: "🎯 On rend la gestion aussi fun que possible !"
      };
      var bioJours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
      var postTypes = ["Conseil", "Réalisation", "Coulisses", "Témoignage", "Promotion", "Astuce", "Engagement"];
      var cal = sujets.slice(0, 7).map(function (sujet, i) {
        return "<li><b>" + bioJours[i] + "</b> – " + postTypes[i] + " : “" + esc(sujet) + "”</li>";
      }).join("");
      function choose() { return sujets[Math.floor(Math.random() * sujets.length)] || "votre activité"; }
      var draft = "📢 <b>" + esc(v.entreprise) + "</b> : " + esc(choose()) + "\n\n" +
        comments[v.tons] + " " + comments[v.tons] + "\n\n" + (v.public ? "🎯 Pour " + esc(v.public) + "\n\n" : "") + hashtags;
      return card(
        "<h3>Stratégie réseaux sociaux – <b>" + esc(v.entreprise) + "</b></h3>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>👤 Bio de profil</h4><p class="ws-quote">' +
        esc(v.entreprise + (v.theme ? " · " + v.theme : "") + (v.public ? " · Pour " + v.public : "") + "\n" + (comments[v.tons] || "")) + "</p>" +
        "<h4>📅 Calendrier éditorial (semaine 1)</h4><ul class='ws-list'>" + cal + "</ul></div>" +
        "<div class=\"ws-box\"><h4>🖊️ Publication prête à poster</h4><pre class=\"ws-pre\">" + esc(draft) + "</pre></div></div>"
      );
    }
  });

  /* ---------- 4. Création de contenus & visuels ---------- */
  TOOLS.push({
    id: "content",
    name: "Création de contenus & visuels",
    desc: "Décrivez votre besoin : l'assistant crée un visuel prêt à l'emploi (SVG généré automatiquement) + les textes associés.",
    icon: "🎨",
    fields: [
      { n: "entreprise", label: "Nom de l'entreprise / produit", type: "text", req: true },
      { n: "type", label: "Type de visuel", type: "select", options: ["Publication Instagram", "Story", "Bannière web", "Plaquette A5", "Annonce"], def: "Publication Instagram" },
      { n: "titre", label: "Titre / accroche", type: "text", req: true, ph: "ex : Votre projet web clé en main" },
      { n: "message", label: "Sous-titre / message", type: "text", ph: "ex : Création, gestion et optimisation" },
      { n: "cta", label: "Bouton d'appel à l'action", type: "text", def: "Demander un devis", ph: "ex : Demander un devis" },
      { n: "couleur", label: "Couleur principale", type: "color", def: "#0CB5A6" }
    ],
    generate: function (v) {
      var sizes = {
        "Publication Instagram": [1080, 1080], "Story": [1080, 1920], "Bannière web": [1920, 400],
        "Plaquette A5": [1080, 720], "Annonce": [1200, 628]
      }[v.type] || [1080, 1080];
      var w = sizes[0], h = sizes[1];
      var color = /^#[0-9a-f]{6}$/i.test(v.couleur) ? v.couleur : "#0CB5A6";
      var title = esc((v.titre || v.entreprise || ""));
      var sub = esc(v.message || v.entreprise || "");
      var cta = esc(v.cta || "Demander un devis");
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' +
        '<rect width="' + w + '" height="' + h + '" fill="#0B1B33"/>' +
        '<circle cx="' + (w * 0.85) + '" cy="' + (h * 0.15) + '" r="' + (Math.max(w, h) * 0.28) + '" fill="' + color + '" opacity="0.18"/>' +
        '<rect width="' + w + '" height="10" fill="' + color + '"/>' +
        '<text x="' + (w / 2) + '" y="' + (h * 0.32) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 18) + '" font-weight="800" fill="#ffffff" text-anchor="middle">' + title + "</text>" +
        '<text x="' + (w / 2) + '" y="' + (h * 0.44) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 36) + '" fill="#9fb3c8" text-anchor="middle">' + sub + "</text>" +
        '<rect x="' + (w / 2 - w * 0.16) + '" y="' + (h * 0.6) + '" width="' + (w * 0.32) + '" height="' + Math.round(h * 0.09) + '" rx="' + Math.round(h * 0.045) + '" fill="' + color + '"/>' +
        '<text x="' + (w / 2) + '" y="' + (h * 0.6 + h * 0.055) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 42) + '" font-weight="700" fill="#ffffff" text-anchor="middle">' + cta + "</text>" +
        '<text x="' + (w / 2) + '" y="' + (h * 0.92) + '" font-family="Arial, sans-serif" font-size="' + Math.round(w / 48) + '" fill="#7CE8C8" text-anchor="middle">GestAffaires · gestion &amp; digital</text>' +
        "</svg>";
      var dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      return card(
        "<h3>Visuel généré – <b>" + esc(v.type) + "</b></h3>" +
        '<div class="ws-visual"><img src="' + dataUri + '" alt="Visuel généré" style="width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;"></div>' +
        '<div class="ws-actions"><a class="admin-btn" href="' + dataUri + '" download="visuel-' + esc(v.entreprise).replace(/\s+/g, "-").toLowerCase() + '.svg">⬇️ Télécharger le visuel (SVG)</a></div>' +
        '<p class="ws-hint">Cliquez-droit sur l’image pour l’enregistrer aussi en PNG (via votre navigateur). Dimensions : ' + w + "×" + h + ".</p>"
      );
    }
  });

  /* ---------- 5. SEO local ---------- */
  TOOLS.push({
    id: "seo",
    name: "SEO local",
    desc: "Donnez le lien de votre site : l'assistant produit mots-clés, balises et checklist technique pour apparaître en premier sur Google.",
    icon: "🔍",
    fields: [
      { n: "site", label: "Adresse de votre site", type: "text", req: true, ph: "https://votre-site.fr" },
      { n: "activite", label: "Activité principale", type: "text", req: true, ph: "ex : agence de communication" },
      { n: "ville", label: "Ville principale", type: "text" },
      { n: "motscles", label: "Mots-clés (un par ligne)", type: "textarea", rows: 3, ph: "création de site web\nagence marketing" }
    ],
    generate: function (v) {
      var kws = (v.motscles || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!kws.length) kws = [v.activite];
      var local = kws.map(function (k) { return k + (v.ville ? " " + v.ville : ""); });
      var kwList = local.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("");
      var title = (v.activite ? v.activite.charAt(0).toUpperCase() + v.activite.slice(1) + " " : "") + (v.ville ? "à " + v.ville + " " : "") + "| GestAffaires";
      var desc = (v.activite ? v.activite.charAt(0).toUpperCase() + v.activite.slice(1) : "Votre activité") + " " + (v.ville ? "à " + v.ville : "en ligne") + ". Site " + esc(v.site) + " : " + kws.slice(0, 3).join(", ") + ". Devis gratuit.";
      return card(
        "<h3>Plan SEO local – <b>" + esc(v.site) + "</b></h3>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>🏷️ Balises prêtes à coller</h4>' +
        '<p class="ws-label">Title (60 car. max)</p><p class="ws-quote">' + esc(title.slice(0, 60)) + "</p>" +
        '<p class="ws-label">Meta description (155 car. max)</p><p class="ws-quote">' + esc(desc.slice(0, 155)) + "</p></div>" +
        '<div class="ws-box"><h4>🔎 Mots-clés locaux</h4><ul class="ws-list">' + kwList + "</ul></div></div>" +
        '<div class="ws-box"><h4>✅ Checklist technique</h4><ul class="ws-list ws-check">' +
        "<li>Installer l'extension Google Business Profile et relier le site</li>" +
        "<li>Vérifier la Search Console (Google Search Console) pour cet URL</li>" +
        "<li>Ajouter une page “Nos réalisations” et une page “Contact” avec carte</li>" +
        "<li>Activer les données structurées (Schema.org LocalBusiness)</li>" +
        "<li>Collecter des avis Google (5 recommandés avant l'achat)</li>" +
        "<li>Vérifier que le site est rapide et 100 % mobile</li></ul></div>" +
        '<p class="ws-hint">💰 Pas de frais cachés : ces actions sont gratuites. Si une option payante (outil de visibilité, annonce locale) est activée un jour, vous serez prévenu avant tout paiement.</p>'
      );
    }
  });

  /* ---------- 6. Google Ads ---------- */
  TOOLS.push({
    id: "ads",
    name: "Google Ads",
    desc: "Budget, objectif, ciblage : l'assistant construit votre campagne publicitaire (annonces, mots-clés, budgets prévisionnels).",
    icon: "📣",
    fields: [
      { n: "entreprise", label: "Nom de l'entreprise", type: "text", req: true },
      { n: "objectif", label: "Objectif de campagne", type: "select", options: ["Téléphone / Contact", "Trafic vers le site", "Ventes en ligne", "Demandes de devis"], def: "Trafic vers le site" },
      { n: "budget", label: "Budget mensuel (€)", type: "number", min: "50", step: "10", def: "300" },
      { n: "ville", label: "Zone de diffusion", type: "text", ph: "ex : toute la France, ou votre ville" },
      { n: "services", label: "Services à promouvoir (un par ligne)", type: "textarea", rows: 3, ph: "Création de site web\nGoogle Business Profile" }
    ],
    generate: function (v) {
      var svcs = (v.services || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var budget = Number(v.budget) || 300;
      var daily = Math.round(budget / 30);
      var cpc = 1.2, convRate = 0.03;
      var clicks = Math.round(budget / cpc);
      var convs = Math.round(clicks * convRate);
      var adGroups = svcs.length ? svcs.slice(0, 4) : ["Site web", "Digital"];
      var agg = adGroups.map(function (s) {
        return "<li><b>Groupe d'annonces : " + esc(s) + "</b><br>Annonce 1 : “" + esc(v.entreprise) + " – " + esc(s) + " sur mesure”<br>Annonce 2 : “" + esc(v.entreprise) + ", " + esc(s) + " dès aujourd'hui”</li>";
      }).join("");
      return card(
        "<h3>Campagne Google Ads – <b>" + esc(v.entreprise) + "</b></h3>" +
        '<div class="ws-grid2">' +
        "<div class=\"ws-box\"><h4>🎯 Structure de campagne</h4><ul class='ws-list'>" +
        "<li><b>Objectif</b> : " + esc(v.objectif) + "</li>" +
        (v.ville ? "<li><b>Zone</b> : " + esc(v.ville) + "</li>" : "") +
        "<li><b>Type</b> : Campagne Search (réseau de recherche)</li>" +
        "<li><b>Enchère</b> : Maximiser les clics (auto)</li>" +
        agg + "</ul></div>" +
        '<div class="ws-box"><h4>📊 Prévisions (estimation)</h4><ul class="ws-list">' +
        "<li>Budget mensuel : <b>" + fmtMoney(budget) + "</b> (" + fmtMoney(daily) + "/jour)</li>" +
        "<li>~ " + clicks + " clics · CPC ~ " + fmtMoney(cpc) + "</li>" +
        "<li>~ " + convs + " contacts générés (au taux " + (convRate * 100).toFixed(0) + " %)</li></ul>" +
        "<h4>✅ Avant de lancer</h4><ul class='ws-list ws-check'>" +
        "<li>Avoir une landing page avec appel à l'action</li>" +
        "<li>Configurer la conversion (téléphone / formulaire)</li>" +
        "<li>Ajouter les mots-clés négatifs (gratuit, devis, formation…)</li></ul></div></div>" +
        '<p class="ws-hint">🔒 Les dépenses publicitaires sont payées directement à Google Ads, jamais via GestAffaires. Vous êtes libre de fixer, modifier ou suspendre le budget à tout moment.</p>'
      );
    }
  });

  /* ---------- 7. Suivi des campagnes ---------- */
  TOOLS.push({
    id: "track",
    name: "Suivi des campagnes",
    desc: "Saisissez vos indicateurs chaque semaine : l'outil calcule clics, coûts, conversions et alerte si les performances chutent.",
    icon: "📈",
    fields: [
      { n: "campagne", label: "Nom de la campagne", type: "text", req: true, ph: "ex : Google Ads – Site web" },
      { n: "budget", label: "Budget du mois (€)", type: "number", min: "0", step: "10", def: "300" },
      { n: "clics", label: "Clics", type: "number", min: "0", step: "1", def: "0" },
      { n: "cout", label: "Coût engagé (€)", type: "number", min: "0", step: "0.5", def: "0" },
      { n: "conversions", label: "Conversions (contacts)", type: "number", min: "0", step: "1", def: "0" }
    ],
    generate: function (v) {
      var clics = Number(v.clics) || 0, cout = Number(v.cout) || 0, convs = Number(v.conversions) || 0, budget = Number(v.budget) || 0;
      var cpc = clics ? (cout / clics) : 0;
      var cpa = convs ? (cout / convs) : 0;
      var ratio = budget ? (cout / budget) : 0;
      var status = ratio > 1 ? '<span class="badge badge-pending">Budget dépassé !</span>'
        : (convs === 0 && clics > 0) ? '<span class="badge badge-draft">Aucune conversion</span>'
        : (convs === 0) ? '<span class="badge badge-draft">En attente</span>'
        : '<span class="badge badge-paid">OK</span>';
      return card(
        "<h3>Suivi – <b>" + esc(v.campagne) + "</b></h3>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>📈 Indicateurs</h4><table class="admin-table"><tbody>' +
        "<tr><td>Budget mensuel</td><td class='right'><b>" + fmtMoney(budget) + "</b></td></tr>" +
        "<tr><td>Coût engagé</td><td class='right'>" + fmtMoney(cout) + "</td></tr>" +
        "<tr><td>Clics</td><td class='right'>" + (clics) + "</td></tr>" +
        "<tr><td>CPC moyen</td><td class='right'>" + fmtMoney(cpc) + "</td></tr>" +
        "<tr><td>Conversions</td><td class='right'>" + (convs) + "</td></tr>" +
        "<tr><td>Coût / contact (CPA)</td><td class='right'>" + (cpa ? fmtMoney(cpa) : "—") + "</td></tr>" +
        "<tr><td>Consommation du budget</td><td class='right'>" + (ratio * 100).toFixed(0) + " %</td></tr>" +
        "</tbody></table></div>" +
        '<div class="ws-box"><h4>🚦 État de la campagne</h4><p style="font-size:20px;">' + status + "</p>" +
        '<p class="ws-hint">Conseil : si le coût par contact dépasse ' + fmtMoney(clics ? Math.max(cpa || 0, 5) : 5) + ", revoyez le ciblage ou les mots-clés négatifs. Saisissez à nouveau vos chiffres chaque semaine pour comparer.</p></div></div>"
      );
    }
  });

  /* ---------- 8. Reporting ---------- */
  TOOLS.push({
    id: "report",
    name: "Reporting",
    desc: "Génère un rapport d'activité automatique à partir de vos factures, devis, contrats et campagnes. Exportable en PDF.",
    icon: "📊",
    fields: [
      { n: "periode", label: "Libellé de la période", type: "text", def: "" , ph: "ex : Septembre 2026" }
    ],
    generate: function (v) {
      var factures = load(LS_FACTURES, []), devis = load(LS_DEVIS, []), contrats = load(LS_CONTRATS, []), clients = load(LS_CLIENTS, []);
      var ca = 0, payees = 0, enAttente = 0;
      factures.forEach(function (f) {
        var tot = f.lignes ? f.lignes.reduce(function (s, l) {
          var q = Number(l.qte) || 0, p = Number(l.pu) || 0, tv = Number(l.tva) || 0;
          return s + q * p * (1 + tv / 100);
        }, 0) : 0;
        if (f.statut !== "annulee") ca += tot;
        if (f.statut === "payee") payees++; else if (f.statut === "en_attente") enAttente++;
      });
      var devisAttente = devis.filter(function (d) { return d.statut === "en_attente"; }).length;
      var outils = getTools();
      var nbCampagnes = (outils.track || []).length;
      var topClient = null, topVal = 0;
      factures.forEach(function (f) {
        var c = clients.filter(function (x) { return x.id === f.clientId; })[0];
        var val = f.lignes ? f.lignes.reduce(function (s, l) { return s + (Number(l.qte) || 0) * (Number(l.pu) || 0); }, 0) : 0;
        if (c && val > topVal) { topVal = val; topClient = c; }
      });
      return card(
        "<h3>Rapport d'activité" + (v.periode ? " – " + esc(v.periode) : "") + "</h3>" +
        '<div class="ws-kpis">' +
        "<div class='ws-kpi'><b>" + fmtMoney(ca) + "</b><span>Chiffre d'affaires</span></div>" +
        "<div class='ws-kpi'><b>" + factures.length + "</b><span>Factures</span></div>" +
        "<div class='ws-kpi'><b>" + clients.length + "</b><span>Clients</span></div>" +
        "<div class='ws-kpi'><b>" + contrats.length + "</b><span>Contrats actifs</span></div>" +
        "<div class='ws-kpi'><b>" + devisAttente + "</b><span>Devis en attente</span></div>" +
        "<div class='ws-kpi'><b>" + nbCampagnes + "</b><span>Campagnes suivies</span></div>" +
        "</div>" +
        '<div class="ws-box"><h4>Points clés</h4><ul class="ws-list">' +
        "<li>" + factures.length + " factures émises, " + payees + " payées, " + enAttente + " en attente de règlement.</li>" +
        (topClient ? "<li>Meilleur client : <b>" + esc(topClient.name || topClient.company) + "</b> (" + fmtMoney(topVal) + " HT).</li>" : "<li>Aucun client suivi pour le moment.</li>") +
        "<li>" + devisAttente + " devis en attente – relance d'ici 7 jours conseillée.</li>" +
        (nbCampagnes ? "<li>" + nbCampagnes + " campagne(s) en cours de suivi.</li>" : "<li>Aucune campagne suivie pour le moment.</li>") +
        "</ul></div>"
      );
    }
  });

  /* ---------- 9. Accompagnement stratégique ---------- */
  TOOLS.push({
    id: "strategy",
    name: "Accompagnement stratégique",
    desc: "Décrivez vos objectifs et vos difficultés : l'assistant bâtit une stratégie d'action personnalisée (plan, priorités, KPIs).",
    icon: "🧭",
    fields: [
      { n: "entreprise", label: "Nom de l'entreprise", type: "text", req: true },
      { n: "objectif", label: "Objectif principal", type: "select", options: ["Gagner des clients", "Développer le chiffre d'affaires", "Améliorer la visibilité", "Mieux gérer l'administratif", "Lancer une nouvelle offre"], def: "Gagner des clients" },
      { n: "difficulte", label: "Ce qui bloque aujourd'hui", type: "select", options: ["Peu de visibilité en ligne", "Pas assez de contacts", "Temps de gestion trop lourd", "Offre mal définie", "Budget limité"], def: "Peu de visibilité en ligne" },
      { n: "horizon", label: "Horizon visé", type: "select", options: ["30 jours", "3 mois", "6 mois", "1 an"], def: "3 mois" }
    ],
    generate: function (v) {
      var plans = {
        "Gagner des clients": [
          "Activer la fiche Google Business Profile (SEO local)",
          "Lancer une campagne Google Ads ciblée (recherche locale)",
          "Mettre en place un système de demande de devis sur le site",
          "Collecter 5 avis clients en 30 jours sur la fiche Google"
        ],
        "Développer le chiffre d'affaires": [
          "Relancer les devis en attente sous 7 jours",
          "Proposer une formule d'abonnement mensuel (revenus récurrents)",
          "Préparer une offre packagée (site + SEO + social) à prix clair",
          "Analyser le panier moyen et créer une offre complémentaire"
        ],
        "Améliorer la visibilité": [
          "Publier 3 fois par semaine sur les réseaux sociaux (calendrier éditorial)",
          "Optimiser les pages du site pour le SEO local",
          "Créer des contenus utiles (conseils, actualités) sur le blog",
          "Cibler les annonces Google Ads sur un périmètre précis"
        ],
        "Mieux gérer l'administratif": [
          "Centraliser factures et documents (Espace de travail)",
          "Programmer les échéances comptables et sociales dans le calendrier",
          "Mettre en place une trésorerie prévisionnelle simple",
          "Déléguer la relance client de manière automatisée"
        ],
        "Lancer une nouvelle offre": [
          "Valider la demande avec 5 entretiens clients",
          "Définir une offre simple, packagée, au prix clair",
          "Préparer une page de vente dédiée sur le site",
          "Communiquer via une campagne de lancement"
        ]
      };
      var actions = (plans[v.objectif] || plans["Gagner des clients"]).map(function (a, i) {
        return "<li>" + (i + 1) + ". " + esc(a) + "</li>";
      }).join("");
      var kpis = ["Contacts reçus / mois", "Taux de conversion devis → client", "Chiffre d'affaires mensuel", "Nombre d'avis clients"].map(function (k) {
        return "<li>" + esc(k) + "</li>";
      }).join("");
      return card(
        "<h3>Stratégie personnalisée – <b>" + esc(v.entreprise) + "</b></h3>" +
        '<div class="ws-grid2">' +
        '<div class="ws-box"><h4>🎯 Diagnostic</h4><p>Objectif : <b>' + esc(v.objectif) + "</b>.<br>Frein identifié : <b>" + esc(v.difficulte) + "</b>.<br>Horizon : <b>" + esc(v.horizon) + "</b>.</p>" +
        "<h4>📋 Plan d'action</h4><ol class='ws-list'>" + actions + "</ol></div>" +
        '<div class="ws-box"><h4>📊 Indicateurs à suivre (KPIs)</h4><ul class="ws-list ws-check">' + kpis + "</ul>" +
        "<h4>💡 Prochaines étapes</h4><ul class='ws-list'>" +
        "<li>Relancer les devis en attente dans les 7 jours</li>" +
        "<li>Programmer 2 rendez-vous de prospection par semaine</li>" +
        "<li>Mettre à jour cet espace de travail chaque semaine</li></ul></div></div>"
      );
    }
  });

  /* ==================================================================
     RENDU
     ================================================================== */
  function renderAll() {
    if (!activeTool) { renderHome(); return; }
    var tool = TOOLS.filter(function (t) { return t.id === activeTool; })[0];
    if (!tool) { activeTool = null; renderHome(); return; }

    var h = history(activeTool);
    var rows = h.length
      ? h.map(function (entry, i) {
          var pre = (entry.title || entry.inputs || {}).entreprise || (entry.inputs || {}).societe || (entry.inputs || {}).campagne || (entry.inputs || {}).site || "Résultat";
          return "<div class='ws-hist-item'><span>" + esc(pre) + "</span><small>" + fmtDate(entry.date || today()) + "</small>" +
            '<span class="row-actions"><button class="mini-btn primary" data-ws-view="' + i + '">Voir</button>' +
            '<button class="mini-btn danger" data-ws-del="' + i + '">Supprimer</button></span></div>';
        }).join("")
      : '<p class="empty-note">Aucun résultat généré pour le moment.</p>';

    var body =
      pageHead(tool.name, tool.desc) +
      card(
        "<h3>🤖 Assistant – remplissez et générez</h3>" +
        '<form id="ws-form" data-ws-tool="' + tool.id + '">' +
        '<div class="admin-form-grid">' + tool.fields.map(fieldHTML).join("") + "</div>" +
        '<div class="admin-form-actions"><button type="submit" class="admin-btn">⚡ Générer automatiquement</button></div>' +
        "</form>"
      ) +
      '<div id="ws-result"></div>' +
      card("<h3>🗃️ Historique</h3>" + rows);

    adminMain().innerHTML = body;

    var form = $("#ws-form", adminMain());
    if (form) form.addEventListener("submit", onGenerate);

    /* navigation interne -> ne pas fermer le panneau */
    $$("[data-ws-home]", adminMain()).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); activeTool = null; renderAll(); });
    });
    $$("[data-ws-view]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-ws-view"));
        var entry = h[i];
        if (!entry) return;
        var out = $("#ws-result", adminMain());
        if (out) out.innerHTML = entry.html;
        window.scrollTo(0, 0);
      });
    });
    $$("[data-ws-del]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () {
        if (confirm("Supprimer ce résultat ?")) {
          removeHistory(activeTool, Number(b.getAttribute("data-ws-del")));
          renderAll();
        }
      });
    });
  }

  function onGenerate(e) {
    e.preventDefault();
    var form = e.target;
    var toolId = form.getAttribute("data-ws-tool");
    var tool = TOOLS.filter(function (t) { return t.id === toolId; })[0];
    if (!tool) return;
    var v = collectFields(form, tool.fields);
    var missing = tool.fields.filter(function (f) { return f.req && !v[f.n]; });
    if (missing.length) {
      var out = $("#ws-result", adminMain());
      if (out) {
        out.innerHTML = '<div class="ws-box" style="border-color:#f0c36d;background:#fffbf0;"><p><b>Champs obligatoires :</b> ' +
          missing.map(function (f) { return esc(f.label); }).join(", ") + ".</p></div>";
      }
      return;
    }
    var html = tool.generate(v);
    var entry = { date: today(), inputs: v, html: html, title: (v.entreprise || v.societe || v.campagne || v.site || tool.name) };
    pushHistory(toolId, entry);
    currentInputs = {};
    renderAll();
    var out = $("#ws-result", adminMain());
    if (out) { out.innerHTML = html; out.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  /* ---------- Accueil : grille de 9 outils ---------- */
  function renderHome() {
    var cards = TOOLS.map(function (t) {
      var n = history(t.id).length;
      return '<button class="ws-tool" data-ws-open="' + t.id + '">' +
        '<span class="ws-tool-icon">' + t.icon + "</span>" +
        "<span class='ws-tool-name'>" + esc(t.name) + "</span>" +
        "<span class='ws-tool-desc'>" + esc(t.desc) + "</span>" +
        "<span class='ws-tool-count'>" + (n ? n + " résultat" + (n > 1 ? "s" : "") : "Nouveau") + "</span></button>";
    }).join("");

    adminMain().innerHTML =
      pageHead("Espace de travail", "6 outils automatisés pour votre activité : complétez, générez, suivez. Tout est enregistré dans votre navigateur.") +
      '<div class="ws-grid">' + cards + "</div>" +
      '<div class="ws-box"><h4>ℹ️ Mode d’emploi</h4><ul class="ws-list">' +
      "<li>Chaque outil est un <b>assistant</b> : vous remplissez les informations demandées, il génère le contenu automatiquement.</li>" +
      "<li>Les résultats sont conservés (historique) et **pas envoyés sur le web** : tout reste dans votre navigateur.</li>" +
      "<li><b>Reporting</b> : le rapport se construit tout seul à partir de vos factures, devis, contrats et campagnes.</li>" +
      "<li>Une vraie intégration IA/serveur (génération avancée, création automatisée Google Business/Ads) est prévue dans une version suivante.</li>" +
      "</ul></div>";

    $$("[data-ws-open]", adminMain()).forEach(function (b) {
      b.addEventListener("click", function () {
        activeTool = b.getAttribute("data-ws-open");
        currentInputs = {};
        history(activeTool).forEach(function (x) {});
        renderAll();
      });
    });
    $$("[data-ws-home]", adminMain()).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); activeTool = null; renderAll(); });
    });
  }

  return {
    render: renderAll
  };
})();