// Serves the page behind a shared profile link (/u/<username>).
// Link-preview bots (WhatsApp, iMessage, Telegram, X ...) read the og: tags to show the profile picture, name and bio;
// real visitors are sent straight on to the app at /?u=<username>.
const SUPABASE_URL = 'https://ljhitfxfnbvxovdkboyw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EXPx9UJ1VdFyGZniFIoJjw_lhVRGsj7';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async function handler(req, res) {
  const raw = String((req.query && req.query.u) || '').trim().replace(/^@/, '');
  const username = /^[A-Za-z0-9._-]{1,40}$/.test(raw) ? raw : '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'mystitch.vercel.app';
  const origin = `https://${host}`;

  let p = null;
  if (username) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_profile_preview`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_username: username }),
      });
      if (r.ok) {
        const j = await r.json();
        p = Array.isArray(j) ? j[0] : j;
      }
    } catch (e) { /* fall back to the generic card */ }
  }

  const name = (p && (p.name || p.username)) || (username ? '@' + username : 'Stitch');
  const title = p ? `${name} (@${p.username || username}) on Stitch` : 'Stitch | Thread and Grow';
  const bio = p && p.bio ? String(p.bio).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  const desc = bio || (p ? `Connect with ${name} on Stitch.` : 'Join Stitch. Share, connect, study together and discover opportunities.');
  const image = p && /^https:\/\//i.test(p.photo || '') ? p.photo : `${origin}/assets/og-image.jpg`;
  const url = `${origin}/u/${encodeURIComponent(username)}`;
  const target = username ? `/?u=${encodeURIComponent(username)}` : '/';

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Stitch">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head><body style="font-family:sans-serif;padding:24px"><a href="${esc(target)}">Open ${esc(name)} on Stitch</a></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(html);
};
