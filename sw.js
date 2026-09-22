// Only offline.html is cached -- app files (core.js, feed.js, etc.) stay untouched so
// ?v=... cache-busting keeps working.
const OFFLINE_CACHE = 'stitch-offline-v1';
const OFFLINE_URL = '/offline.html';

// Runtime cache for user-uploaded media (profile photos, post/glimpse images & videos,
// resumes, etc). These are fetched from Supabase Storage. We cache them the first time
// they load successfully so profile pictures and other media keep showing when offline,
// rather than reverting to a broken-image icon.
const MEDIA_CACHE = 'stitch-media-v1';
const MEDIA_CACHE_MAX_ENTRIES = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
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
  if (request.destination === 'image' || request.destination === 'video' || request.destination === 'audio') return true;
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

  // Page navigations: try the network, fall back to the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.open(OFFLINE_CACHE).then((cache) => cache.match(OFFLINE_URL))
      )
    );
    return;
  }

  // Media (avatars, post photos/videos, etc): cache-first for instant + offline
  // availability, refreshed from the network in the background when online.
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
    vibrate: isCall ? [400, 200, 400, 200, 400, 200, 400] : [150],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
      return undefined;
    })
  );
});
