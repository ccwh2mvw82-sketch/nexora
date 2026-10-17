// GestAffaires - Edge Function: send-message
//
// Envoi d'un e-mail a un client depuis l'espace de travail (module
// Messagerie). Utilise Resend.
//
// SECURITE : cette fonction refuse tout envoi tant que la variable
// d'environnement SEND_SECRET n'est pas definie, et exige l'en-tete
// "x-ga-key" egal a cette valeur. Cela evite d'en faire un relais ouvert.
//
// Variables d'environnement :
//   RESEND_API_KEY  = re_...
//   FROM_EMAIL      = GestAffaires <no-reply@gestaffaires.fr>
//   SEND_SECRET     = une longue chaine aleatoire (obligatoire)
//   ALLOWED_ORIGINS = https://gestaffaires.fr,https://www.gestaffaires.fr
//
// Deploiement :
//   supabase functions deploy send-message --no-verify-jwt
//   supabase secrets set SEND_SECRET=... RESEND_API_KEY=... FROM_EMAIL=...

function corsHeaders(req: Request): Headers {
  const h = new Headers();
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "https://gestaffaires.fr,https://www.gestaffaires.fr")
    .split(",").map((s) => s.trim());
  if (origin && allowed.includes(origin)) h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Headers", "content-type, apikey, authorization, x-ga-key");
  return h;
}

function esc(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers });

  const secret = Deno.env.get("SEND_SECRET") || "";
  if (!secret || req.headers.get("x-ga-key") !== secret) {
    return Response.json({ sent: false, error: "non autorise" }, { status: 403, headers });
  }

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL") || "GestAffaires <no-reply@gestaffaires.fr>";
  if (!key) return Response.json({ sent: false, error: "Resend non configure" }, { status: 503, headers });

  const body = await req.json().catch(() => null) as {
    to?: string; subject?: string; body?: string; html?: string;
  } | null;
  if (!body) return Response.json({ sent: false, error: "bad json" }, { status: 400, headers });

  const to = String(body.to || "").trim().slice(0, 200);
  const subject = String(body.subject || "Message GestAffaires").slice(0, 200);
  if (!to || !to.includes("@")) {
    return Response.json({ sent: false, error: "destinataire invalide" }, { status: 400, headers });
  }
  const html = body.html
    ? String(body.html).slice(0, 20000)
    : "<p>" + esc(String(body.body || "").slice(0, 8000)).replace(/\n/g, "<br>") + "</p>";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) return Response.json({ sent: false, error: "HTTP " + r.status }, { status: 502, headers });
    return Response.json({ sent: true }, { status: 200, headers });
  } catch (e) {
    return Response.json({ sent: false, error: String(e) }, { status: 502, headers });
  }
});
