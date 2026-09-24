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
  /* Code d'inscription admin (démo uniquement ; en prod responsable).
     En production : insérez ce code hashé dans la table admin_keys
     via le SQL Editor de Supabase (voir supabase/schema.sql). */
  adminCode: "GEST-2026"
};