/* ============================================================
   GestAffaires – Configuration (Supabase + Stripe)
   Copiez ce fichier vers js/config.js puis remplissez vos clés.
   NE COMMITEZ JAMAIS js/config.js avec des clés réelles.
   ============================================================ */
window.GA_CONFIG = {
  supabase: {
    /* 1. https://supabase.com -> Dashboard -> votre projet
          -> Settings > API : copiez la Project URL et l'anon key. */
    url: "https://ddetftmqyklkbdmnmzgg.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZXRmdG1xeWtsa2JkbW5temdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjU1NzAsImV4cCI6MjEwNTg0MTU3MH0.yv5z4f8Cnbu3F7E2_aaUDAttPkqA7CQRf4QFSaepN-4"
  },
  /* 2. Stripe : créez un Payment Link par formule
       (Dashboard -> Payment Links -> "+" -> produit/prix),
       puis collez chaque URL ici. Laisser vide désactive "Commander". */
  stripe: {
    essentiel: "https://buy.stripe.com/bJe8wPej994x0a8b3ycIE05",
    confort: "https://buy.stripe.com/eVqdR9cb14Oh1ec4FacIE03",
    pro: "https://buy.stripe.com/8x28wP0sjeoRg966NicIE01",
    visibilite: "https://buy.stripe.com/bJebJ12Ar6Wp7CA6NicIE04",
    visibilite_plus: "https://buy.stripe.com/3cI14n5MD4OhbSQc7CcIE06",
    developpement: "https://buy.stripe.com/7sY8wP0sj0y19KIefKcIE02"
  },
  /* Code d'inscription admin (démo uniquement ; en prod responsable).
     En production : insérez ce code hashé dans la table admin_keys
     via le SQL Editor de Supabase (voir supabase/schema.sql). */
  adminCode: "GEST-2026"
};