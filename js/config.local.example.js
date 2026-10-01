/* ============================================================
   GestAffaires - Configuration LOCALE (non versionnee)

   Ce fichier est OPTIONNEL. Il sert uniquement en developpement ou
   pour le mode local (hors Supabase) : il permet de garder un code
   admin secret sur votre machine sans jamais le publier.

   UTILISATION (3 etapes)
   1. Copiez ce fichier vers js/config.local.js
      Sous Windows :
        Copy-Item js\config.local.example.js js\config.local.js

   2. Renseignez adminCode ci-dessous.

   3. Chargez-le dans la page, APRES js/config.js :
        <script src="js/config.local.js"></script>
      C'est cette etape qui rend le fichier effectif : sans elle,
      le mode local attribue toujours le role "client".
      Placez la balise juste avant <script src="js/app.js">.

   4. Repetez l'etape 3 sur chaque page (les 4 pages HTML).
      Le fichier reste absent de Git : rien ne part sur GitHub.

   EN PRODUCTION SUR LE SITE PUBLIE, CE N'EST PAS NECESSAIRE
   L'acces admin normal ne depend d'aucun secret cote navigateur :
   vous saisissez votre code dans le formulaire, et le serveur le
   compare au hash stocke dans la table admin_keys (RPC
   check_admin_code / claim_admin).

   PENSEZ A RETIRER LA BALISE <script src="js/config.local.js">
   AVANT DE PUBLIER : sur un site en ligne, elle chercherait un
   fichier absent et provoquerait une erreur 404 dans la console.
   ============================================================ */
(function () {
  var prev = window.GA_CONFIG || (window.GA_CONFIG = {});
  window.GA_LOCAL_CONFIG = {
    /* Code admin utilise uniquement par le mode local de app.js.
       VIDE = l'inscription locale attribue toujours le role "client". */
    adminCode: ""
  };
  if (window.GA_LOCAL_CONFIG.adminCode) {
    prev.adminCode = window.GA_LOCAL_CONFIG.adminCode;
  }
})();