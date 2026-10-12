// GestAffaires - Edge Function: send-notification
//
// Notifie l'administrateur par e-mail (Resend) quand un prospect envoie
// le formulaire de contact. Le prospect est deja stocke dans la table
// leads par la RPC client insert_lead ; cette fonction ne fait que
// preven'ir l'admin + envoyer un accuse de reception au client.
//
// Variables d'environnement :
//   RESEND_API_KEY = re_...
//   FROM_EMAIL     = no-reply@gestaffaires.fr
//   ADMIN_EMAIL    = l'adresse qui recoit les notifications
//   ALLOWED_ORIGINS = https://gestaffaires.fr,https://www.gestaffaires.fr
//
// Deploiement :
//   supabase functions deploy send-notification --no-verify-jwt

function corsHeaders(req: Request): Headers {
  const h = new Headers();
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "https://gestaffaires.fr,https://www.gestaffaires.fr")
    .split(",").map((s) => s.trim());
  if (origin && allowed.includes(origin)) h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  return h;
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL") || "GestAffaires <no-reply@gestaffaires.fr>";
  if (!key || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return r.ok;
  } catch (_) {
    return false;
  }
}

function esc(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "bad json" }, { status: 400, headers });

  const name = String(body.name || "").slice(0, 120);
  const email = String(body.email || "").slice(0, 200).toLowerCase();
  const phone = String(body.phone || "").slice(0, 40);
  const subject = String(body.subject || "").slice(0, 200);
  const message = String(body.message || "").slice(0, 4000);
  const page = String(body.page || "").slice(0, 80);
  const formula = String(body.formula || "").slice(0, 80);

  if (!name || !email || !email.includes("@")) {
    return Response.json({ error: "champs manquants" }, { status: 400, headers });
  }
  // Anti-spam basique : longueurs bornees (cote serveur).
  if (message.length > 4000 || name.length > 120) {
    return Response.json({ error: "contenu trop long" }, { status: 400, headers });
  }

  const admin = Deno.env.get("ADMIN_EMAIL") || "";
  const site = Deno.env.get("SITE_URL") || "https://gestaffaires.fr";

  const rows =
    "<p>Nouveau message sur " + esc(site) + " (page : " + esc(page) + ")</p>" +
    "<table cellpadding='6'><tr><td><b>Nom</b></td><td>" + esc(name) + "</td></tr>" +
    (phone ? "<tr><td><b>Téléphone</b></td><td>" + esc(phone) + "</td></tr>" : "") +
    "<tr><td><b>E-mail</b></td><td>" + esc(email) + "</td></tr>" +
    (formula ? "<tr><td><b>Formule</b></td><td>" + esc(formula) + "</td></tr>" : "") +
    (subject ? "<tr><td><b>Sujet</b></td><td>" + esc(subject) + "</td></tr>" : "") +
    (message ? "<tr><td><b>Message</b></td><td>" + esc(message).replace(/\n/g, "<br>") + "</td></tr>" : "") +
    "</table>";

  const adminSent = admin ? await sendMail(admin, "Nouveau message - GestAffaires", rows) : false;
  const clientSent = await sendMail(
    email,
    "Nous avons bien reçu votre demande - GestAffaires",
    "<p>Bonjour " + esc(name) + ",</p><p>Merci pour votre message. Nous revenons vers vous " +
    "rapidement.</p><p>— L'équipe GestAffaires<br>" + esc(site) + "</p>"
  );

  return Response.json({ admin: adminSent, client: clientSent }, { status: 200, headers });
});