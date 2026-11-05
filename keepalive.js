// Daily wake-up call so the free Supabase project is never left idle long enough to be paused.
// Vercel runs this once a day (see "crons" in vercel.json). It only asks the database for one public profile card.
const SUPABASE_URL = 'https://ljhitfxfnbvxovdkboyw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EXPx9UJ1VdFyGZniFIoJjw_lhVRGsj7';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_profile_preview`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_username: 'mister_festus' }),
    });
    res.status(200).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    res.status(200).json({ ok: false, error: 'unreachable', at: new Date().toISOString() });
  }
};
