// Only offline.html is cached
const OFFLINE_CACHE = 'stitch-offline-v216';
const OFFLINE_URL = '/offline.html';

// Runtime cache for user-uploaded media (profile photos, post/glimpse images & videos,
// resumes, etc)
const MEDIA_CACHE = 'stitch-media-v1';
const MEDIA_CACHE_MAX_ENTRIES = 400;


self.addEventListener('install', (event) => {
  // Keep a copy of the offline page so it can be shown when the network is down.
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== OFFLINE_CACHE && n !== MEDIA_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

function isMediaRequest(request){
  if (request.method !== 'GET') return false;
  // Videos/audio aren't handled here. Browsers ask for them in byte ranges (206) and the Cache API
  // can't store or answer those, which left feed videos stuck on the picture. Let them stream.
  if (request.destination === 'video' || request.destination === 'audio') return false;
  if (request.headers && request.headers.has('range')) return false;
  if (request.destination === 'image') return true;
  try {
    const url = new URL(request.url);
    // Supabase Storage public object URLs, wherever the project is hosted.
    return url.pathname.includes('/storage/v1/object/');
  } catch (e) {
    return false;
  }
}

async function trimMediaCache(){
  const cache = await caches.open(MEDIA_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - MEDIA_CACHE_MAX_ENTRIES;
  if (excess > 0) {
    // Oldest entries were added first; caches.keys() preserves insertion order.
    await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Page navigations: always load live
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(async () => {
        try {
          const cache = await caches.open(OFFLINE_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
        } catch (e) {}
        return Response.error();
      })
    );
    return;
  }

  // Media (avatars, post photos/videos, etc): cache-first for instant + offline
  // availability, refreshed from the network in the background when online
  if (isMediaRequest(req)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkFetch = fetch(req.clone ? req.clone() : req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(req, res.clone());
              trimMediaCache();
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          // Serve the cached copy immediately; let the network update run silently.
          event.waitUntil(networkFetch);
          return cached;
        }
        const fresh = await networkFetch;
        return fresh || new Response('', { status: 504, statusText: 'Offline and not cached yet' });
      })
    );
  }
});

// Profile picture cropped to a circle (transparent corners) so the phone shows it round
async function circleIcon(url){
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const S = 192, c = new OffscreenCanvas(S, S), x = c.getContext('2d');
    x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.closePath(); x.clip();
    const m = Math.min(bmp.width, bmp.height);
    x.drawImage(bmp, (bmp.width - m) / 2, (bmp.height - m) / 2, m, m, 0, 0, S, S);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return 'data:image/png;base64,' + btoa(bin);
  } catch (e) { return null; }
}

// Round grey initials picture for people with no profile photo (drawn on the phone, sent as a data: image)
async function initialsIcon(name){
  try {
    const w = (name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length || typeof OffscreenCanvas === 'undefined') return null;
    const ini = ((w[0][0] || '') + (w.length > 1 ? (w[w.length - 1][0] || '') : '')).toUpperCase();
    const c = new OffscreenCanvas(192, 192), x = c.getContext('2d');
    x.beginPath(); x.arc(96, 96, 96, 0, Math.PI * 2); x.closePath(); x.clip();
    x.fillStyle = '#e5e7eb'; x.fillRect(0, 0, 192, 192);
    x.fillStyle = '#4b5563'; x.font = '700 80px Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ini, 96, 100);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return 'data:image/png;base64,' + btoa(bin);
  } catch (e) { return null; }
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {  }

  const title = payload.title || 'Stitch';
  const isCall = payload.data && payload.data.kind === 'call';
  const options = {
    body: payload.body || '',
    tag: payload.tag || undefined,
    data: payload.data || {},
    renotify: !!payload.tag,
    requireInteraction: !!isCall,
    silent: false,
    image: (payload.image || (payload.data && payload.data.thumb)) || undefined,
    // The sender's profile picture when there is one (data.avatar), then a post thumbnail, then the logo
    icon: (payload.data && (payload.data.avatar || payload.data.thumb)) || '/assets/icon-192.png',
    badge: '/assets/badge-96.png',
    vibrate: isCall ? [400, 200, 400, 200, 400, 200, 400] : [150],
  };

  event.waitUntil((async () => {
    const d = payload.data || {};
    {
      if (d.avatar) {
        const ic = await circleIcon(d.avatar);
        if (ic) options.icon = ic;
      } else if (!d.thumb && d.name && !isCall) {
        const ic = await initialsIcon(d.name);
        if (ic) options.icon = ic;
      }
      if (!d.avatar && !d.thumb && isCall && d.callerName) {
        const ic = await initialsIcon(d.callerName);
        if (ic) options.icon = ic;
      }
    }
    await self.registration.showNotification(title, options);
    if (isCall) {
      // If the app is open (even in the background) let it ring properly with the ringtone
      try {
        const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        cl.forEach(c => { try { c.postMessage({ type: 'call-push', data: d }); } catch (e) {} });
      } catch (e) {}
      // Keep the phone ringing: re-alert every few seconds while the call notification is still showing
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try {
          const open = await self.registration.getNotifications({ tag: options.tag });
          if (!open.length) break;
          await self.registration.showNotification(title, options);
        } catch (e) { break; }
      }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const postId = data.postId;
  // Server-sent meeting pushes carry the code as data.code on meeting_admin / meeting_reminder notifications
  const meetingCode = data.meetingCode || ((typeof data.type === 'string' && data.type.indexOf('meeting_') === 0 && data.code) ? data.code : null);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          if (postId != null) { try { client.postMessage({ type: 'open-post', postId }); } catch (e) {} }
          if (meetingCode) { try { client.postMessage({ type: 'open-meeting', code: meetingCode }); } catch (e) {} }
          if (data.kind === 'call' && data.convoId) { try { client.postMessage({ type: 'call-push', data }); } catch (e) {} }
          if (data.convoId && data.kind !== 'call') { try { client.postMessage({ type: 'open-chat', convoId: data.convoId }); } catch (e) {} }
          if (data.type === 'connect_request') { try { client.postMessage({ type: 'open-requests' }); } catch (e) {} }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(meetingCode ? '/?meeting=' + encodeURIComponent(meetingCode) : (postId != null ? '/?post=' + encodeURIComponent(postId) : '/'));
      return undefined;
    })
  );
});
