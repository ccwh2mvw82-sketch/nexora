/* ============================================================
   GestAffaires – Configuration (Supabase + Stripe)
   Copiez ce fichier vers js/config.js puis remplissez vos clés.
   NE COMMITEZ JAMAIS js/config.js avec des clés réelles.
   ============================================================ */
window.GA_CONFIG = {
  supabase: {
    /* 1. https://supabase.com -> Dashboard -> votre projet
          -> Settings > API : copiez la Project URL et l'anon key. */
    url: "",
    anonKey: ""
  },
  /* 2. Stripe : créez un Payment Link par formule
       (Dashboard -> Payment Links -> "+" -> produit/prix),
       puis collez chaque URL ici. Laisser vide désactive "Commander". */
  stripe: {
    essentiel: "",
    confort: "",
    pro: "",
    visibilite: "",
    visibilite_plus: "",
    developpement: ""
  },
  /* Aucun code admin ici : ce fichier peut être versionné, donc il ne
     doit contenir aucun secret. Pour un code admin en développement,
     créez js/config.local.js (non versionné) — voir config.local.example.js.
     En production, le serveur valide le code saisi par l'utilisateur
     via la RPC check_admin_code : aucun secret n'est nécessaire ici. */
};