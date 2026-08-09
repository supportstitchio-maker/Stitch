// send-push: delivers a real Web Push notification to every device a
// given app user has subscribed from (see push_subscriptions table +
// initPushNotifications in core.js). Called from sendCallRing and
// sendMessageRemote in chat.js, and fireStudyNotification in courses.js.
//
// ---- One-time setup ----
//   1. Run supabase/migrations/push_subscriptions.sql in the SQL editor.
//   2. Set secrets (from the project root, alongside /supabase):
//        supabase secrets set VAPID_PUBLIC_KEY=<value> VAPID_PRIVATE_KEY=<value> VAPID_SUBJECT=mailto:you@example.com
//      VAPID_PUBLIC_KEY must be the exact same string as the
//      VAPID_PUBLIC_KEY constant near the top of core.js -- see
//      PUSH_SETUP.md for the key pair already generated for this app.
//   3. Deploy: supabase functions deploy send-push
//
// Trust model: requires a valid Supabase Auth session from the caller
// (any signed-in app user) -- same as the existing ai-proxy function.
// It does NOT separately check whether the caller is "allowed" to
// notify toUserId (e.g. that they share a conversation) -- add that
// check below (e.g. look up the messages/connections table) if you
// want to lock that down further.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured on the server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer /i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller really is a signed-in app user before we send
    // anything on their behalf (anon-key client + their own JWT).
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { toUserId, title, body, tag, data } = await req.json();
    if (!toUserId || !title) {
      return new Response(JSON.stringify({ error: "toUserId and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client: reads subscriptions for whoever is being
    // notified, which is normally someone other than the caller, so
    // this has to bypass the per-user RLS policy on push_subscriptions.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: subs, error: subsErr } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", toUserId);
    if (subsErr) throw subsErr;

    const payload = JSON.stringify({
      title,
      body: body || "",
      tag: tag || undefined,
      data: data || {},
    });

    const results = await Promise.allSettled(
      (subs || []).map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          .catch(async (err: any) => {
            // 404/410 means the push service considers this
            // subscription permanently gone (browser data cleared,
            // uninstalled, etc.) -- clean it up so we stop retrying it
            // forever.
            if (err && (err.statusCode === 404 || err.statusCode === 410)) {
              await adminClient.from("push_subscriptions").delete().eq("id", s.id);
            }
            throw err;
          })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, total: (subs || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
