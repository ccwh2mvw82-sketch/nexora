// GestAffaires - Edge Function: stripe-webhook
//
// VERIFIE la signature Stripe puis, sur checkout.session.completed paye,
// marque la commande 'paid' en base (RPC complete_order, reservee au
// serveur). Emet ensuite un mail de confirmation via Resend.
//
// Variables d'environnement (Supabase > Edge Functions > Secrets) :
//   STRIPE_WEBHOOK_SECRET = whsec_... (Dashboard Stripe > Webhooks)
//   RESEND_API_KEY        = re_...   (Resend)
//   FROM_EMAIL            = e.g. no-reply@gestaffaires.fr
//   ADMIN_EMAIL           = e-mail de notification de l'admin
//   SITE_URL              = https://gestaffaires.fr (liens dans les mails)
//
// Deploiement :
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   puis, cote Stripe : ajouter un Webhook sur votre projet pointant vers
//   {SUPABASE_URL}/functions/v1/stripe-webhook avec les evts :
//   checkout.session.completed, payment_intent.payment_failed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function cors(origin: string): Headers {
  const h = new Headers();
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "https://gestaffaires.fr,https://www.gestaffaires.fr")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  return h;
}

async function verifyStripeSignature(secret: string, payload: string, header: string | null): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",");
  let t = "", sig = "";
  for (const p of parts) {
    if (p.startsWith("t=")) t = p.slice(2);
    else if (p.startsWith("v1=")) sig = p.slice(3);
  }
  if (!t || !sig) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + payload));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === sig;
}

async function sendResend(opts: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL") || "GestAffaires <no-reply@gestaffaires.fr>";
  if (!key || !opts.to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
    });
    return r.ok;
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers });

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const ok = await verifyStripeSignature(secret, raw, signature);
  if (!ok) return new Response("bad signature", { status: 400, headers });

  let event: any;
  try { event = JSON.parse(raw); } catch (_) {
    return new Response("bad payload", { status: 400, headers });
  }

  const type: string = event?.type || "";
  const session = event?.data?.object || {};

  if (type === "checkout.session.completed") {
    const paid = session?.payment_status === "paid" || session?.payment_status === "no_payment_required";
    if (paid) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        { auth: { persistSession: false } }
      );
      const orderId = session?.metadata?.order_id || session?.client_reference_id || "";
      const email = String(session?.customer_details?.email || session?.customer_email || "").toLowerCase();
      const amountTotal = Number(session?.amount_total || 0) / 100;
      let done = false;

      if (orderId) {
        const { data } = await supabase.rpc("complete_order", {
          p_order_id: orderId, p_stripe_session: session?.id || "",
        });
        done = !!data;
      }
      if (!done && email && amountTotal > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .eq("customer", email)
          .eq("status", "pending")
          .eq("amount", amountTotal)
          .limit(5);
        if (orders && orders.length) {
          const { data } = await supabase.rpc("complete_order", {
            p_order_id: orders[0].id, p_stripe_session: session?.id || "",
          });
          done = !!data;
        }
      }
      if (done) {
        const site = Deno.env.get("SITE_URL") || "https://gestaffaires.fr";
        await sendResend({
          to: email,
          subject: "Confirmation de votre commande - GestAffaires",
          text:
            "Bonjour,\n\nVotre paiement a bien ete encaisse (" +
            amountTotal.toFixed(2) + " EUR). Nous vous contactons rapidement\n" +
            "pour activer votre accompagnement.\n\n" + site + "\n\nL'equipe GestAffaires",
        });
      }
    }
  }

  if (type === "payment_intent.payment_failed") {
    await sendResend({
      to: String(session?.receipt_email || "").toLowerCase() || Deno.env.get("ADMIN_EMAIL") || "",
      subject: "Paiement echoue - GestAffaires",
      text: "Un paiement GestAffaires n'a pas pu aboutir. Contactez-nous si besoin.",
    });
  }

  return new Response("ok", { status: 200, headers });
});