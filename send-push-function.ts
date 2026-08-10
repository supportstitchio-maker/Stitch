// ---- New file: supabase/functions/send-push/index.ts ----
//
// This is the server-side half of real browser push notifications (calls,
// chat messages, study reminders -- see sendPushTo in core.js, which POSTs
// here with { toUserId, title, body, tag, data }). This function:
//   1. Verifies the caller's access token with Supabase Auth (never
//      trusts a client-supplied identity -- same reasoning as
//      ai-proxy-routing-snippet.ts / send-email-function.ts).
//   2. Looks up every device `toUserId` has subscribed from, via the
//      service-role key (bypasses RLS -- this function is the one place
//      allowed to read someone else's push_subscriptions rows).
//   3. Sends a real Web Push message to each of those devices using the
//      VAPID keys.
//
// Deploy with:
//   supabase functions deploy send-push
//
// One-time setup before it'll actually send anything:
//   1. Generate a VAPID key pair (e.g. `npx web-push generate-vapid-keys`).
//   2. The PUBLIC key must match VAPID_PUBLIC_KEY in core.js exactly --
//      they're a pair; mismatched keys fail silently on the client side.
//   3. supabase secrets set VAPID_PUBLIC_KEY=BG...   (same value as core.js)
//   4. supabase secrets set VAPID_PRIVATE_KEY=...    (keep this one secret)
//   5. supabase secrets set VAPID_SUBJECT=mailto:you@yourdomain.com
//
// ---- Why push notifications stopped arriving ----
// The browser sends a CORS *preflight* (an OPTIONS request) before the
// real POST whenever a fetch carries custom headers, which sendPushTo's
// Authorization/apikey headers trigger. If OPTIONS isn't answered with a
// 200 and the right Access-Control-Allow-* headers -- which is exactly
// what happens if a function only ever handles POST -- the browser blocks
// the request client-side before your code even runs, and every push
// silently fails with a CORS error in the console. The `if (req.method
// === "OPTIONS")` line below is what was missing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:notifications@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // This is the actual fix: previously there was no dedicated response
  // for OPTIONS, so the browser's preflight request either fell through
  // to the POST handler (which 400s/401s without a body) or hit a
  // platform default with no CORS headers on it at all -- either way the
  // browser's preflight check failed and it refused to ever send the
  // real POST, which is exactly the "blocked by CORS policy" error.
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    // Verify the caller the same way send-email / ai-proxy do -- the JWT
    // in Authorization is checked against Supabase Auth's server, so a
    // modified frontend can't forge a push to/from someone else.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await sbAuth.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { toUserId, title, body, tag, data } = await req.json();
    if (!toUserId) {
      return new Response(JSON.stringify({ error: "Missing toUserId" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Service-role client: the only place allowed to read another
    // account's push_subscriptions rows (RLS would otherwise block this,
    // same reasoning as the comment in core.js).
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: subs, error: subsErr } = await sbAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", toUserId);

    if (subsErr) {
      return new Response(JSON.stringify({ error: "Lookup failed", detail: subsErr.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!subs || !subs.length) {
      // Not an error -- this account just has no subscribed devices
      // (push never set up, or permission denied). Same fire-and-forget
      // philosophy as the client: nothing to send isn't a failure.
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title: title || "Stitch", body: body || "", tag, data });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ),
      ),
    );

    // A 404/410 from the push service means that subscription is dead
    // (browser data cleared, permission revoked, etc.) -- clean those up
    // so this account's next push doesn't keep retrying a device that's
    // never coming back.
    const deadEndpoints = results
      .map((r, i) => ({ r, endpoint: subs[i].endpoint }))
      .filter(({ r }) => r.status === "rejected" && [404, 410].includes((r as PromiseRejectedResult).reason?.statusCode))
      .map(({ endpoint }) => endpoint);
    if (deadEndpoints.length) {
      await sbAdmin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ ok: true, sent, total: subs.length }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
