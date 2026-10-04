/* Stitch analytics (PostHog)
 * ---------------------------------------------------------------------------
 * Loaded BEFORE core.js so the fetch hook is in place before the Supabase
 * client is created. Everything here is a safe no-op until the project key
 * below is filled in, and it can never throw into the rest of the app.
 *
 * Privacy rules this file enforces:
 *   - No autocapture (nothing is recorded just because it was clicked/typed).
 *   - Users are identified by their Supabase user id only: never email/name.
 *   - Event properties are small and hand-picked; request bodies are never sent.
 *   - Session replay masks every input and fully BLOCKS sensitive screens
 *     (chat, calls, ID/poster verification, payouts, CV/career, enrolment
 *     forms, settings, sign-in).
 *   - URL query strings and #hashes are stripped everywhere (the OAuth sign-in
 *     return puts access tokens in the #hash).
 */
(function () {
  'use strict';

  // ---- 1. CONFIG: paste the two values from PostHog > Project settings ----
  var POSTHOG_KEY  = 'phc_opx8LVuipTxTHffL2svicqcGuqoMTGLRJ5tYE6E9aYGs';          // starts with phc_
  var POSTHOG_HOST = 'https://us.i.posthog.com';          // or https://eu.i.posthog.com
  var ENABLE_SESSION_REPLAY = true;

  var enabled = !!POSTHOG_KEY && POSTHOG_KEY.indexOf('phc_') === 0;
  var ph = null;

  // ---- 2. Scrubbing helpers ----
  function cleanUrl(u) {
    if (typeof u !== 'string') return u;
    return u.split('#')[0].split('?')[0];
  }
  var URL_KEYS = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$pathname'];

  function scrubEvent(evt) {
    try {
      if (!evt) return evt;
      var p = evt.properties;
      if (p) {
        URL_KEYS.forEach(function (k) { if (typeof p[k] === 'string') p[k] = cleanUrl(p[k]); });
        if (p.$set && typeof p.$set === 'object') {
          URL_KEYS.forEach(function (k) { if (typeof p.$set[k] === 'string') p.$set[k] = cleanUrl(p.$set[k]); });
        }
        if (p.$set_once && typeof p.$set_once === 'object') {
          URL_KEYS.forEach(function (k) { if (typeof p.$set_once[k] === 'string') p.$set_once[k] = cleanUrl(p.$set_once[k]); });
        }
        // Session replay: rrweb "Meta" events (type 4) carry the page href.
        var snap = p.$snapshot_data;
        if (Array.isArray(snap)) {
          snap.forEach(function (s) {
            if (s && s.type === 4 && s.data && typeof s.data.href === 'string') s.data.href = cleanUrl(s.data.href);
          });
        }
      }
    } catch (e) { /* never block an event on scrubbing */ }
    return evt;
  }

  // ---- 3. Init ----
  function init() {
    if (!enabled || ph || !window.posthog || typeof window.posthog.init !== 'function') return;
    try {
      window.posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        rageclick: false,
        disable_surveys: true,
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        respect_dnt: true,
        mask_personal_data_properties: true,
        disable_session_recording: !ENABLE_SESSION_REPLAY,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '[data-ph-sensitive]',
          blockSelector: '[data-ph-sensitive], [data-ph-no-capture]',
          maskCapturedNetworkRequestFn: function () { return null; },   // never record network payloads
          recordHeaders: false,
          recordBody: false
        },
        before_send: scrubEvent,
        loaded: function (p) {
          ph = p;
          try { p.register({ platform: isNative() ? 'native_app' : 'web' }); } catch (e) {}
        }
      });
      ph = window.posthog;
    } catch (e) { ph = null; }
  }

  function isNative() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }

  // ---- 4. Public helper: window.track('event', { small: 'props' }) ----
  function track(name, props) {
    try { if (ph && typeof ph.capture === 'function') ph.capture(name, props || {}); } catch (e) {}
  }
  window.track = track;

  // ---- 5. Network hook: sign-ins, payments, AI, key RPCs (no bodies are sent) ----
  var RPC_EVENTS = {
    join_class_by_code:       { event: 'class_joined', needsJsonOk: true },
    join_collaboration_by_id: { event: 'collaboration_joined' },
    submit_classwork_assignment: { event: 'classwork_submitted', props: { kind: 'assignment' } },
    submit_classwork_quiz:       { event: 'classwork_submitted', props: { kind: 'quiz' } }
  };
  var FN_EVENTS = {
    'ai-proxy':        'ai_request',
    'paystack-verify': 'payment_verification',
    'bright-function': 'payment_verification'
  };

  function urlOf(input) {
    try { return typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) { return ''; }
  }

  function afterFetch(url, init, res) {
    try {
      if (!ph) return;
      var m;
      if ((m = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i))) {
        var name = m[1];
        // course enrolment goes through course_report_self(p_action = 'enroll')
        if (name === 'course_report_self') {
          var act = null;
          try { act = JSON.parse(init && init.body).p_action; } catch (e) {}
          if (act === 'enroll' && res.ok) track('course_enrolled');
          return;
        }
        var cfg = RPC_EVENTS[name];
        if (!cfg || !res.ok) return;
        if (cfg.needsJsonOk) {
          res.clone().json().then(function (j) {
            if (j && j.ok === false) return;
            track(cfg.event, cfg.props);
          }).catch(function () {});
        } else {
          track(cfg.event, cfg.props);
        }
        return;
      }
      if ((m = url.match(/\/functions\/v1\/([a-z0-9_-]+)/i)) && FN_EVENTS[m[1]]) {
        var fn = m[1];
        if (fn === 'ai-proxy') {
          // status only: this is what surfaces "out of credits" / provider failures
          track('ai_request', { ok: !!res.ok, status: res.status });
        } else {
          res.clone().json().then(function (j) {
            track('payment_verification', {
              source: fn === 'paystack-verify' ? 'course_or_subscription' : 'class',
              http_ok: !!res.ok,
              verified: !!(j && (j.verified === true || j.success === true || j.ok === true))
            });
          }).catch(function () { track('payment_verification', { source: fn, http_ok: !!res.ok }); });
        }
        return;
      }
      if (/\/auth\/v1\/otp(\?|$)/.test(url) && res.ok) { track('login_code_requested'); return; }
      if (/\/auth\/v1\/verify(\?|$)/.test(url) && res.ok) { track('login_code_verified'); return; }
    } catch (e) { /* analytics must never break a request */ }
  }

  if (enabled && typeof window.fetch === 'function') {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var p = nativeFetch(input, init);
      try {
        var url = urlOf(input);
        if (url && (url.indexOf('/rest/v1/rpc/') > -1 || url.indexOf('/functions/v1/') > -1 || url.indexOf('/auth/v1/') > -1)) {
          p.then(function (res) { afterFetch(url, init, res); }, function () {
            if (url.indexOf('/functions/v1/ai-proxy') > -1) track('ai_request', { ok: false, status: 0 });
          });
        }
      } catch (e) {}
      return p;
    };
  }

  // ---- 6. Screens that must never appear in replays ----
  var SENSITIVE_OVERLAYS = {
    conversation: 1, newMessage: 1, forwardMessage: 1,
    call: 1, addToCall: 1, incomingCall: 1, lectureCall: 1, incomingLectureCall: 1,
    posterApplication: 1, posterDashboard: 1, adminDashboard: 1,
    creatorWallet: 1, creatorWithdraw: 1, receipts: 1,
    jobApply: 1, careerStart: 1, careerMatching: 1, careerMatches: 1, careerAnalytics: 1,
    courseEnroll: 1, classPaymentConfirm: 1,
    profileMenu: 1, blockedAccounts: 1, reportOpportunity: 1, reportClass: 1,
    myContacts: 1, inviteStudents: 1, inviteCoTeacher: 1
  };
  var TAB_NAMES = ['home', 'explore', 'study', 'messages', 'profile'];

  function markSensitive(id, on) {
    try {
      var el = document.getElementById(id);
      if (!el) return;
      if (on) el.setAttribute('data-ph-sensitive', '1'); else el.removeAttribute('data-ph-sensitive');
    } catch (e) {}
  }

  function wrapGlobal(name, before, after) {
    try {
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__phWrapped) return;
      var w = function () {
        try { if (before) before.apply(this, arguments); } catch (e) {}
        var out = orig.apply(this, arguments);
        try { if (after) after.apply(this, arguments); } catch (e) {}
        return out;
      };
      w.__phWrapped = true;
      window[name] = w;
    } catch (e) {}
  }

  var lastScreen = null;
  function screenSeen(name) {
    if (name && name !== lastScreen) { lastScreen = name; track('screen_viewed', { screen: name }); }
  }

  function installHooks() {
    // Sign-in screen: block the whole gate (shows email + code boxes)
    markSensitive('auth-gate', true);

    wrapGlobal('openOverlay', function (kind) {
      markSensitive('overlay', !!SENSITIVE_OVERLAYS[kind]);   // before the screen renders
    }, function (kind) { screenSeen(kind); });

    wrapGlobal('closeOverlay', function () {
      markSensitive('overlay', false);
    });

    wrapGlobal('switchTab', function (n) {
      markSensitive('screen', n === 3);       // Messages tab = the chat list
    }, function (n) { screenSeen('tab_' + (TAB_NAMES[n] || n)); });

    // Actions we can only observe at the moment the user submits
    wrapGlobal('submitPost', null, function () { track('post_submitted'); });
    wrapGlobal('submitJobApplication', null, function () { track('job_application_submitted'); });
    wrapGlobal('submitPosterApplication', null, function () { track('poster_application_submitted'); });
    wrapGlobal('submitPosterApplicationOverlay', null, function () { track('poster_application_submitted'); });
  }

  // ---- 7. Identify by Supabase user id only ----
  var identifiedId = null;
  function installAuth() {
    try {
      if (typeof getSupabaseClient !== 'function') return;
      var sb = getSupabaseClient();
      if (!sb || !sb.auth) return;
      sb.auth.onAuthStateChange(function (event, session) {
        try {
          var u = session && session.user;
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && u && u.id) {
            if (identifiedId !== u.id) {
              identifiedId = u.id;
              if (ph) ph.identify(u.id);          // id only: no email, no name
            }
            // First-ever sign-in for a brand new account
            var created = Date.parse(u.created_at || ''), last = Date.parse(u.last_sign_in_at || '');
            var key = 'stitchPhSignedUp:' + u.id;
            if (created && last && Math.abs(last - created) < 90000 && !localStorage.getItem(key)) {
              localStorage.setItem(key, '1');
              track('signed_up');
            }
          } else if (event === 'SIGNED_OUT') {
            // The app ignores spurious sign-outs on flaky networks; only reset if truly signed out.
            sb.auth.getSession().then(function (r) {
              if (!(r && r.data && r.data.session) && ph) { identifiedId = null; ph.reset(); }
            }).catch(function () {});
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  // ---- 8. Boot ----
  init();
  function boot() { try { installHooks(); installAuth(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
