// GestAffaires - Edge Function: stripe-checkout
//
// Cree cote serveur une Checkout Session Stripe avec metadata.order_id :
// le webhook stripe-webhook pourra alors marquer la commande 'paid' sans
// aucune ambiguite (et sans jamais faire confiance au navigateur).
//
// Variables d'environnement :
//   STRIPE_SECRET_KEY = sk_live_... (compte Stripe)
//   PARAMETRES DES FORMULES avec une variable par prix, ex (une JWT
//   par pool de prix ; ici on utilise PARAMETRES/SECRETS nommes) :
//     STRIPE_PRICE_ESSENTIEL = price_...
//     STRIPE_PRICE_CONFORT   = price_...
//     STRIPE_PRICE_PRO       = price_...
//     STRIPE_PRICE_VISIBILITE = price_...
//     STRIPE_PRICE_VISIBILITE_PLUS = price_...
//     STRIPE_PRICE_DEVELOPPEMENT = price_...
//
// Tant que ces prix ne sont pas renseignes, la fonction repond 400 et le
// site bascule automatiquement vers les Payment Links existants.
//
// Deploiement :
//   supabase functions deploy stripe-checkout

const PRICES: Record<string, string> = {
  essentiel: Deno.env.get("STRIPE_PRICE_ESSENTIEL") || "",
  confort: Deno.env.get("STRIPE_PRICE_CONFORT") || "",
  pro: Deno.env.get("STRIPE_PRICE_PRO") || "",
  visibilite: Deno.env.get("STRIPE_PRICE_VISIBILITE") || "",
  visibilite_plus: Deno.env.get("STRIPE_PRICE_VISIBILITE_PLUS") || "",
  developpement: Deno.env.get("STRIPE_PRICE_DEVELOPPEMENT") || "",
};

function cors(): Headers {
  const h = new Headers();
  const origin = Deno.env.get("ALLOWED_ORIGINS") || "https://gestaffaires.fr,https://www.gestaffaires.fr";
  // la requete du navigateur est portee par fetch + JWT anon ; on reflete
  // l'origine si elle figure dans la liste blanche.
  return h;
}

Deno.serve(async (req) => {
  const headers = cors();
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "https://gestaffaires.fr,https://www.gestaffaires.fr")
    .split(",").map((s) => s.trim());
  if (origin && allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers });

  let body: any;
  try { body = await req.json(); } catch (_) {
    return Response.json({ error: "bad json" }, { status: 400, headers });
  }
  const formula = String(body.formula || "");
  const customer = String(body.customer || "").slice(0, 200);
  const orderId = String(body.order_id || "") || null;

  const price = PRICES[formula];
  const secret = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!price || !secret) {
    return Response.json({ error: "stripe non configure" }, { status: 400, headers });
  }

  const base = (Deno.env.get("SITE_URL") || "https://gestaffaires.fr").replace(/\/+$/, "");
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price]", price);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", base + "/?success=1&session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url", base + "/?cancel=1");
  if (customer) form.set("customer_email", customer);
  if (orderId) {
    form.set("client_reference_id", orderId);
    form.set("metadata[order_id]", orderId);
  }
  form.set("metadata[formula]", formula);

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + secret,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await r.json().catch(() => ({ error: { message: "stripe indisponible" } }));
  if (!r.ok || !json.url) {
    return Response.json({ error: json?.error?.message || "stripe error" }, { status: r.status, headers });
  }
  return Response.json({ url: json.url, session_id: json.id }, { status: 200, headers });
});