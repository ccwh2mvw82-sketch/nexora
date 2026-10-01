/* ============================================================
   GestAffaires – Informations société et contact

   >>> CE FICHIER EST LE SEUL ENDROIT A MODIFIER <<<
   Le telephone, l'email, l'adresse et les mentions legales y sont
   ecrits UNE SEULE FOIS. Le script les injecte automatiquement dans
   toutes les pages du site (marqueurs data-site="...").

   Pour changer le numero de telephone plus tard : modifiez la ligne
   "phoneDisplay" ci-dessous, et rien d'autre.

   !! ATTENTION : deux endroits au total, pas un seul.
   Les moteurs de recherche lisent les donnees structurees (JSON-LD)
   sans executer de JavaScript, on ne peut donc pas y injecter la valeur.
   Pour un changement de numero, editez :
     1. ce fichier          -> phoneDisplay et phoneDigits
     2. index.html          -> "telephone" du bloc JSON-LD
        (les 3 pages poles ne portent pas de telephone en JSON-LD)
   Un controle automatise (voir qa-jsonld.ps1) signale toute divergence.

   IMPORTANT : ce fichier est versionne et public. N'y mettez aucun
   secret (ce sont uniquement des informations destined au public).

   Les valeurs marquées TODO doivent etre completees avant la mise en
   ligne commerciale (elles apparaissent dans les mentions legales,
   obligation legale en France).
   ============================================================ */
window.GA_SITE = {
  /* ---------- Contact ---------- */
  phoneDisplay: "06 12 34 56 78",      // tel: 06 12 34 56 78
  phoneDigits: "33612345678",         // sans « + », pour les liens tel: et WhatsApp
  email: "gestaffaires45@gmail.com",

  /* ---------- Identité ---------- */
  company: "GestAffaires – Gestion & Digital",

  /* ---------- Mentions légales ----------
     TODO : a completer avec les informations reelles de l'entreprise. */
  legalForm: "TODO",                  // ex. SASU, SARL, EI...
  address: "TODO",                    // adresse complete
  siret: "TODO",                      // numero SIRET (14 chiffres)
  rcs: "TODO",                        // ville et numero RCS
  director: "TODO",                   // directeur de publication
  host: "TODO",                       // hebergeur du site (nom + adresse)
  hostUrl: "",                        // lien vers la page de l'hebergeur

  /* ---------- Reseaux ---------- */
  instagram: "https://www.instagram.com/gestaffaires",
  linkedin: "",                       // TODO : coller l'URL du profil
  facebook: "",                       // TODO : coller l'URL du profil
  googleReviews: ""                   // TODO : lien vers la fiche Google
};