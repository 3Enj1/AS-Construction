// Called by the apply_material_transaction() Postgres trigger (via pg_net)
// whenever a material crosses its low-stock threshold in either direction.
// Sends an email (Resend) and a WhatsApp message (Twilio) to the admin.
// Deploy with --no-verify-jwt since the caller is Postgres, not a logged-in
// user; the x-webhook-secret header is what authorizes the request instead.

type StockAlertPayload = {
  event: "low_stock" | "restocked";
  material: string;
  stock: number;
  threshold: number;
  unit: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("WEBHOOK_SHARED_SECRET");
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as StockAlertPayload;
  const isLow = payload.event === "low_stock";
  const emoji = isLow ? "\u{1F534}" : "\u{1F7E2}";
  const subject = `${emoji} ${isLow ? "Low stock" : "Restocked"}: ${payload.material}`;
  const detail = isLow
    ? `${payload.material} dropped to ${payload.stock} ${payload.unit} (threshold ${payload.threshold} ${payload.unit}).`
    : `${payload.material} is back up to ${payload.stock} ${payload.unit} (threshold ${payload.threshold} ${payload.unit}).`;

  const appUrl = Deno.env.get("APP_URL");
  const link = appUrl ? `${appUrl.replace(/\/$/, "")}/materials` : undefined;

  const results = await Promise.allSettled([
    sendEmail(subject, detail, link),
    sendWhatsApp(`${emoji} AS Construction Hub\n${detail}${link ? `\n${link}` : ""}`),
  ]);

  const summary = results.map((r) => (r.status === "fulfilled" ? "ok" : String(r.reason)));
  for (const r of results) {
    if (r.status === "rejected") console.error("notify-stock-alert channel failed:", r.reason);
  }

  return new Response(JSON.stringify({ results: summary }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function sendEmail(subject: string, detail: string, link: string | undefined) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const to = Deno.env.get("ADMIN_EMAIL");
  if (!apiKey || !from || !to) throw new Error("Email not configured (missing Resend/admin env vars)");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: detail + (link ? `\n\nView materials: ${link}` : ""),
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

async function sendWhatsApp(body: string) {
  // Account SID (starts with AC) always identifies the account in the URL.
  // Basic-auth credentials can be either that same Account SID + its Auth
  // Token, OR a separate API Key (starts with SK) + its secret — Twilio
  // accepts both pairs for Basic auth. If an API key is set, prefer it.
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authUser = Deno.env.get("TWILIO_API_KEY_SID") || accountSid;
  const authSecret = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. "whatsapp:+14155238886"
  const to = Deno.env.get("ADMIN_WHATSAPP_NUMBER"); // e.g. "whatsapp:+27821234567"
  if (!accountSid || !authUser || !authSecret || !from || !to) {
    throw new Error("WhatsApp not configured (missing Twilio/admin env vars)");
  }

  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${authUser}:${authSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Twilio failed: ${res.status} ${await res.text()}`);
}
