// Service worker for Stitch push notifications (calls, chat messages,
// study reminders). Registered from initPushNotifications() in core.js.
// This file must be deployed at the SITE ROOT (next to index.html), not
// inside a subfolder -- a service worker's scope is limited to the
// directory it's served from and everything below it, and push needs it
// to cover the whole app.
//
// This runs independently of any open tab, which is the whole point:
// it's what lets a notification show up even after every tab/window for
// the app has been closed.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// The send-push Edge Function (supabase/functions/send-push) sends a
// JSON payload shaped like { title, body, tag, data }. `tag` groups
// related notifications so a second "X is calling you" replaces the
// first instead of stacking; `data` carries along whatever the tapped
// notification needs (e.g. { kind: 'call', convoId }).
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { /* malformed/empty payload -- show a generic notification below */ }

  const title = payload.title || 'Stitch';
  const isCall = payload.data && payload.data.kind === 'call';
  const options = {
    body: payload.body || '',
    tag: payload.tag || undefined,
    data: payload.data || {},
    renotify: !!payload.tag,
    // Incoming calls stay on screen until the person deals with them
    // instead of auto-dismissing like a regular chat notification.
    requireInteraction: !!isCall,
    // The Notifications API has no way to attach a custom sound file --
    // no browser has ever supported one. Setting silent:false (rather
    // than leaving it undefined) makes sure the OS/browser's own
    // built-in notification sound always plays instead of being
    // silently suppressed.
    silent: false,
    // Vibration is the other half of the device's built-in alert --
    // pair it with a pattern so calls feel distinct from a regular
    // message. Values are ms: [vibrate, pause, vibrate, ...].
    // Calls repeat like a real ring; regular notifications get one
    // short buzz.
    vibrate: isCall ? [400, 200, 400, 200, 400, 200, 400] : [150],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open tab for this app if
// there is one, otherwise opens a new one at the root.
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
