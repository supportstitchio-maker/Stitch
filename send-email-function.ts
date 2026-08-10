// ---- New file: supabase/functions/send-email/index.ts ----
//
// This is the server-side half of "Email notifications" in Settings.
// The client (see sendEmailNotification in core.js, called from addNotif
// in overlays.js whenever appPrefs.notifEmail is on) POSTs here with
// { subject, title, body, url }. This function:
//   1. Verifies the caller's access token with Supabase Auth (never
//      trusts a client-supplied user id/email -- same reasoning as
//      ai-proxy-routing-snippet.ts).
//   2. Looks up that user's real email address itself.
//   3. Sends the email via Resend.
//
// Deploy with:
//   supabase functions deploy send-email
//
// One-time setup before it'll actually send anything:
//   1. Create a free account at https://resend.com
//   2. Verify a sending domain (or use their onboarding@resend.dev
//      sender for testing -- fine for development, but real domain
//      verification is required before this can email real users).
//   3. Create an API key in the Resend dashboard.
//   4. supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//   5. Update FROM_ADDRESS below to something on your verified domain,
//      e.g. "Stitch <notifications@yourdomain.com>".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDRESS = "Stitch <onboarding@resend.dev>"; // swap for your verified domain

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    // Verify the caller the same way ai-proxy does -- the JWT in
    // Authorization is checked against Supabase Auth's server, so a
    // modified frontend can't forge someone else's identity here.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const toEmail = userData.user.email;

    const { subject, title, body, url } = await req.json();
    if (!subject && !body) {
      return new Response(JSON.stringify({ error: "Nothing to send" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <p style="font-size:15px;font-weight:600;margin:0 0 8px;">${escapeHtml(title || "Stitch")}</p>
        <p style="font-size:14px;color:#374151;line-height:1.5;margin:0 0 20px;">${escapeHtml(body || "")}</p>
        ${url ? `<a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">Open in Stitch</a>` : ""}
        <p style="font-size:12px;color:#9ca3af;margin-top:28px;">You're getting this because Email notifications is turned on in Stitch &rarr; Settings. Turn it off there anytime.</p>
      </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: toEmail,
        subject: subject || "New notification on Stitch",
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return new Response(JSON.stringify({ error: "Resend failed", detail: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
