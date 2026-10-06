const PUBLIC_PROFILES_TABLE = 'public_profiles';
        const CONNECTION_REQUESTS_TABLE = 'connection_requests';

        let publicProfileSyncRetries = 0;
        let publicProfileSyncTimer = null;
        function schedulePublicProfileRetry(){
          if (publicProfileSyncTimer || publicProfileSyncRetries >= 8) return;
          publicProfileSyncRetries++;
          publicProfileSyncTimer = setTimeout(() => { publicProfileSyncTimer = null; syncPublicProfile(); }, Math.min(30000, 2500 * publicProfileSyncRetries));
        }
        window.addEventListener('online', () => { publicProfileSyncRetries = 0; syncPublicProfile(); });


        // Pulls the offending column name out of a "column doesn't exist" database error
        // (PostgREST PGRST204 "Could not find the 'x' column ..." or Postgres 42703 "column x does
        // not exist")
        function missingColumnFromError(err){
          if (!err) return null;
          const msg = String(err.message || '') + ' ' + String(err.details || '');
          let m = msg.match(/Could not find the '([^']+)' column/i);
          if (m) return m[1];
          if (err.code === '42703' || /column .* does not exist/i.test(msg)) {
            m = msg.match(/column\s+(?:[\w]+\.)?"?([a-z_][\w]*)"?\s+(?:of relation .* )?does not exist/i);
            if (m) return m[1];
          }
          return null;
        }

        let publicProfileSyncInFlight = null;
        function syncPublicProfile(){
          // Collapse simultaneous calls into one so overlapping syncs never race each other.
          if (publicProfileSyncInFlight) return publicProfileSyncInFlight;
          publicProfileSyncInFlight = syncPublicProfileNow().finally(() => { publicProfileSyncInFlight = null; });
          return publicProfileSyncInFlight;
        }

        async function syncPublicProfileNow(){
          const sb = getSupabaseClient();
          if (!sb) return { ok: true };
          try {
            const user = await getCachedAuthUser();
            if (!user) { schedulePublicProfileRetry(); return { ok: false }; }
            const meta = user.user_metadata || {};
            const emailPrefix = (user.email || '').split('@')[0] || '';
            // Fall back to the name saved on the login account itself, so a profile that hasn't loaded
            // yet (or was never filled in) still publishes a real name instead of nothing
            const typedName = (profileData.name || '').trim() || String(meta.full_name || meta.name || '').trim();
            const typedUsername = (profileData.username || '').trim();
            if (!typedName && !typedUsername) { schedulePublicProfileRetry(); return { ok: true }; }
            // Never publish the email prefix as someone's name -- use their real name or username only
            const name = typedName || typedUsername;
            if (!name) return { ok: true };
            const row = {
              user_id: user.id,
              name,
              pronouns: (profileData.pronouns || '').trim(),
              bio: profileData.bio || '',
              links: Array.isArray(profileData.links) ? profileData.links : [],
              // Discover only lists rows where deleted = false; a NULL here hid new people.
              deleted: false,
              updated_at: new Date().toISOString(),
            };
            // Only send a username when there is one: omitting it can't trip a NOT NULL / unique
            // constraint on the column, and never overwrites a username already saved on the server
            if (typedUsername) row.username = typedUsername;
            if (profileData.photo && String(profileData.photo).indexOf('data:') !== 0) row.photo = profileData.photo;
            else if (profileData.photoCleared) row.photo = null;

            const isUsernameError = (err) => !!err && err.code === '23505' && /username/i.test(err.message || err.details || '');
            let error = null;
            // Writes the row, and if the database reports a column that doesn't exist on this table
            // (older schema: e.g. no `links`, `pronouns`, `bio` or `updated_at`), drops just that
            // column and tries again
            const writeRow = async (r) => {
              let e = null;
              // 1) Upsert keyed on user_id.
              ({ error: e } = await sb.from(PUBLIC_PROFILES_TABLE).upsert(r, { onConflict: 'user_id' }));
              // 2) Fallback: update the existing row, or insert a new one.
              if (e && !isUsernameError(e) && !missingColumnFromError(e)) {
                const upd = await sb.from(PUBLIC_PROFILES_TABLE).update(r).eq('user_id', user.id).select('user_id');
                if (!upd.error && upd.data && upd.data.length) e = null;
                else if (!upd.error) {
                  const ins = await sb.from(PUBLIC_PROFILES_TABLE).insert(r);
                  e = ins.error || null;
                } else e = upd.error;
              }
              return e;
            };
            let attemptRow = Object.assign({}, row);
            for (let attempt = 0; attempt < 8; attempt++) {
              error = await writeRow(attemptRow);
              if (!error || isUsernameError(error)) break;
              const badCol = missingColumnFromError(error);
              if (badCol && badCol in attemptRow && badCol !== 'user_id') { delete attemptRow[badCol]; continue; }
              if (/deleted/i.test(error.message || '') && 'deleted' in attemptRow) { delete attemptRow.deleted; continue; }
              break;
            }
            if (error) {
              console.warn('Syncing public profile failed:', error);
              const isUsernameConflict = isUsernameError(error);
              if (!isUsernameConflict) schedulePublicProfileRetry();
              return { ok: false, usernameConflict: isUsernameConflict, error };
            }
            publicProfileSyncRetries = 0;
            return { ok: true };
          } catch (e) {
            console.warn('Syncing public profile failed:', e);
            schedulePublicProfileRetry();
            return { ok: false, error: e };
          }
        }

        let profileData = {
          name: '',
          username: '',
          pronouns: '',
          bio: '',
          gender: '',
          photo: null,
          // True once the person has explicitly removed their photo (see deleteProfilePicture below)
          photoCleared: false,
          // Timestamp (ms) of the last time the person edited their own profile
          updatedAt: 0,
          link: '',
          links: []
        };

        // Restores profileData to the same shape as its initial value above, in place (same object
        // reference, so anything that captured the reference stays in sync)
        function resetProfileDataToDefault(){
          profileData.name = '';
          profileData.username = '';
          profileData.pronouns = '';
          profileData.bio = '';
          profileData.gender = '';
          profileData.photo = null;
          profileData.photoCleared = false;
          profileData.updatedAt = 0;
          profileData.link = '';
          profileData.links = [];
        }

        // ---- Profile cache: last-known-good name/username/photo for this account, kept in
        // localStorage so it's available INSTANTLY the next time this account logs in --
        const PROFILE_CACHE_PREFIX = 'stitchProfileCache:';

        function profileCacheKeyForUser(userId){
          return userId ? (PROFILE_CACHE_PREFIX + userId) : null;
        }

        function saveProfileCacheSnapshot(userId){
          try {
            if (!userId || typeof localStorage === 'undefined') return;
            // Nothing worth caching yet (e.g. a brand-new account that hasn't finished profile setup)
            if (!((profileData.name || '').trim() || (profileData.username || '').trim())) return;
            const key = profileCacheKeyForUser(userId);
            const snapshot = {
              name: profileData.name || '',
              username: profileData.username || '',
              pronouns: profileData.pronouns || '',
              bio: profileData.bio || '',
              // A photo mid-upload can briefly be a data
              photo: (profileData.photo && String(profileData.photo).indexOf('data:') === 0) ? null : (profileData.photo || null),
              photoCleared: !!profileData.photoCleared,
              updatedAt: Number(profileData.updatedAt) || 0,
              links: Array.isArray(profileData.links) ? profileData.links : [],
            };
            localStorage.setItem(key, JSON.stringify(snapshot));
          } catch (e) { /* storage full/unavailable/private-mode -- caching is a nicety, never worth breaking the profile over */ }
        }

        // Loads this account's cached snapshot straight into the live profileData object (same
        // reference, so anything holding onto it stays in sync), resetting to defaults first so
        function hydrateProfileFromCache(userId){
          // Always reset first, even when this userId has no cached snapshot
          if (typeof resetProfileDataToDefault === 'function') resetProfileDataToDefault();
          try {
            const key = profileCacheKeyForUser(userId);
            if (!key || typeof localStorage === 'undefined') return false;
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const cached = JSON.parse(raw);
            if (!cached || typeof cached !== 'object') return false;
            Object.assign(profileData, cached);
            return true;
          } catch (e) { return false; }
        }

        function clearProfileCacheSnapshot(userId){
          try {
            const key = profileCacheKeyForUser(userId);
            if (key && typeof localStorage !== 'undefined') localStorage.removeItem(key);
          } catch (e) {}
        }

        // Belt-and-suspenders sweep for sign-out on a shared/public device, matching
        // clearAllFeedCaches in feed.js
        function clearAllProfileCaches(){
          try {
            if (typeof localStorage === 'undefined') return;
            Object.keys(localStorage).forEach(k => {
              if (k.indexOf(PROFILE_CACHE_PREFIX) === 0) localStorage.removeItem(k);
            });
          } catch (e) {}
        }

        // ---- Profile screen render ----
        function hasCompleteProfile(){
          return !!((profileData.name || '').trim() && (profileData.username || '').trim());
        }
        function requireCompleteProfile(){
          if (hasCompleteProfile()) return true;
          openAppAlertModal('Add your full name and a username before you can do that.');
          openEditProfileModal();
          return false;
        }

        const PRONOUN_OPTIONS = ['He/Him', 'She/Her', 'They/Them', 'Prefer not to say'];

        let lastOwnPhotoRestoreAt = 0;
        function maybeRestoreOwnPhotoFromPublicRow(){
          if (profileData.photo || profileData.photoCleared) return;
          if (Date.now() - lastOwnPhotoRestoreAt < 15000) return;
          lastOwnPhotoRestoreAt = Date.now();
          getCachedAuthUser().then(user => { if (user && typeof restoreProfileFromPublicRow === 'function') restoreProfileFromPublicRow(user.id); }).catch(() => {});
        }

        // The profile never shows an error message
        function profileIsEmpty(){
          return !(profileData.name || '').trim() && !(profileData.username || '').trim();
        }
        function profileLoadBannerHTML(){ return ''; }
        function retryLoadProfile(){
          if (typeof reloadProfileNow === 'function') reloadProfileNow(true);
        }

        // Display-only fallback (never saved or published): the name on the login account, and the
        // email prefix as a handle, so the header is never blank while the profile loads
        let profileDisplayFallback = { name: '', username: '' };
        async function loadProfileDisplayFallback(){
          try {
            if (typeof getCachedAuthUser !== 'function') return;
            const user = await getCachedAuthUser();
            if (!user) return;
            const meta = user.user_metadata || {};
            profileDisplayFallback = {
              name: String(meta.full_name || meta.name || '').trim(),
              username: ((user.email || '').split('@')[0] || '').trim()
            };
            if (profileIsEmpty() && typeof currentTab !== 'undefined' && currentTab === 4 && typeof patchProfileHeaderInPlace === 'function') patchProfileHeaderInPlace();
          } catch (e) {}
        }
        function profileShownName(){ return (profileData.name || '').trim() || profileDisplayFallback.name; }
        function profileShownUsername(){ return (profileData.username || '').trim() || profileDisplayFallback.username; }
        function profileNamePlaceholderHTML(width){
          return `<span class="skel-line skel-shimmer" style="display:inline-block;width:${width};height:0.9em;vertical-align:middle;"></span>`;
        }
        function profileUsernameHTML(){
          const u = profileShownUsername();
          return u ? `<span class="nm-inner grad-text">${escapeHtml(u)}</span>` : profileNamePlaceholderHTML('7rem');
        }
        function profileNameHTML(){
          const n = profileShownName();
          return (n ? escapeHtml(n) : profileNamePlaceholderHTML('9rem')) + ` <span class="font-normal text-gray-400">${profileData.pronouns || ''}</span>`;
        }

        // Keeps trying (quietly, with a short backoff) until the profile has real data, and again
        // whenever the connection comes back or the app returns to the foreground
        let profileAutoLoadTimer = null;
        let profileAutoLoadAttempts = 0;
        function startProfileAutoLoad(){
          if (profileAutoLoadTimer || !profileIsEmpty()) { if (!profileIsEmpty()) profileAutoLoadAttempts = 0; return; }
          const delay = Math.min(6000, 1200 + profileAutoLoadAttempts * 800);
          profileAutoLoadAttempts++;
          profileAutoLoadTimer = setTimeout(async () => {
            profileAutoLoadTimer = null;
            if (!profileIsEmpty()) { profileAutoLoadAttempts = 0; return; }
            try { if (typeof reloadProfileNow === 'function') await reloadProfileNow(true); } catch (e) {}
            if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof patchProfileHeaderInPlace === 'function') patchProfileHeaderInPlace();
            startProfileAutoLoad();
          }, delay);
        }
        window.addEventListener('online', () => { profileAutoLoadAttempts = 0; startProfileAutoLoad(); });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { profileAutoLoadAttempts = 0; startProfileAutoLoad(); } });

        function renderProfile(){
          if (profileIsEmpty()) {
            if (typeof reloadProfileNow === 'function') reloadProfileNow(false);
            loadProfileDisplayFallback();
            startProfileAutoLoad();
          }
          maybeRestoreOwnPhotoFromPublicRow();
          const screenEl = document.getElementById('screen');
          if (screenEl && document.getElementById('profile-tab-content')) {
            patchProfileHeaderInPlace();
            return;
          }
          screenEl.innerHTML = profileScreenHTML();
          lastRenderedProfileGridKey = profileTabContentKey();
        }

        // Fingerprint of whatever is currently sitting inside #profile-tab-content, so
        // patchProfileHeaderInPlace (below) can tell whether the grid actually needs to be
        let lastRenderedProfileGridKey = null;

        function profileTabContentKey(){
          const items = (profileTab === 'reposts') ? feedPosts.filter(p => p.reposted)
            : (profileTab === 'saved') ? feedPosts.filter(p => p.saved)
            : feedPosts.filter(p => p.mine && !p.isRepost);
          // Not just IDs: also fold in whether each post still has its reposted/saved flag and its
          // media, so an unsave/un-repost or an edit is still picked up even if the ID list is
          return profileTab + '|' + items.map(p => `${p.id}:${p.reposted?1:0}:${p.saved?1:0}:${p.uploading?1:0}:${p.mediaHtml?1:0}`).join(',');
        }

        // Split out so both the initial render (profileScreenHTML) and the in-place patch
        // (patchProfileHeaderInPlace) can share it
        function profileAdminDashboardButtonHTML(){
          const isAdmin = typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin();
          const btn = (fn, label, icon) => `<button onclick="${fn}()" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-medium text-sm" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon(icon || 'trending','w-4 h-4')} ${label}</button>`;
          return `
            <div class="mb-2 flex flex-col gap-2">
              ${isAdmin ? btn('openAdminDashboard', 'Admin Dashboard') : ''}
              ${isAdmin ? '' : btn('openPosterDashboard', 'Dashboard')}
            </div>`;
        }

        // Repaints just this button
        function refreshProfilePosterButton(){
          const el = document.getElementById('profile-admin-btn-el');
          if (el) el.innerHTML = profileAdminDashboardButtonHTML();
        }

        function patchProfileHeaderInPlace(){
          const usernameEl = document.getElementById('profile-username-el');
          const photoEl = document.getElementById('profile-photo-el');
          const nameEl = document.getElementById('profile-name-el');
          const bioEl = document.getElementById('profile-bio-el');
          const linksEl = document.getElementById('profile-links-el');
          const postsCountEl = document.getElementById('profile-posts-count-el');
          const networkCountEl = document.getElementById('profile-network-count-el');
          if (!usernameEl || !photoEl || !nameEl || !bioEl || !linksEl || !postsCountEl || !networkCountEl) {
            const screenEl = document.getElementById('screen');
            if (screenEl) screenEl.innerHTML = profileScreenHTML();
            return;
          }
          const loadBannerEl = document.getElementById('profile-load-banner-el');
          if (loadBannerEl) loadBannerEl.innerHTML = profileLoadBannerHTML();
          usernameEl.innerHTML = profileUsernameHTML();
          photoEl.outerHTML = profilePhotoButtonHTML();
          nameEl.innerHTML = profileNameHTML();
          bioEl.textContent = profileData.bio;
          linksEl.innerHTML = profileLinksHTML(profileData.links);
          postsCountEl.textContent = myPostsCount();
          networkCountEl.textContent = networkConnectionCount();
          // Admin status resolves asynchronously (see profileAdminDashboardButtonHTML above)
          const adminBtnEl = document.getElementById('profile-admin-btn-el');
          if (adminBtnEl) adminBtnEl.innerHTML = profileAdminDashboardButtonHTML();
          const tabsEl = document.getElementById('profile-tabs');
          if (tabsEl) tabsEl.innerHTML = profileTabsHTML();
          // Only rebuild the posts grid when what it should show has actually changed (different
          // account, different posts, a save/repost toggle, etc)
          const tabContentEl = document.getElementById('profile-tab-content');
          const newKey = profileTabContentKey();
          if (tabContentEl && newKey !== lastRenderedProfileGridKey) {
            tabContentEl.innerHTML = profileTabContent();
            lastRenderedProfileGridKey = newKey;
          }
        }

        function profilePhotoButtonHTML(){
          // If a photo URL is set but fails to load (e.g. it was never actually finished uploading,
          // or points at something that's since been removed), fall back to the plain silhouette
          // placeholder instead of leaving the browser's own broken-image glyph on screen
          const hasPhoto = !!profileData.photo;
          const media = hasPhoto
            ? `<img src="${profileData.photo}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="w-full h-full items-center justify-center" style="display:none;">${Icon('user','w-9 h-9')}</div>`
            : Icon('user','w-9 h-9');
          return `<button id="profile-photo-el" ${hasPhoto ? `onclick="viewProfilePhoto('${escapeForJsAttr(profileData.photo)}', '${escapeForJsAttr(profileData.name || '')}')"` : ''} class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style="color:${NAVY};background:rgba(10,37,64,0.14);">${media}</button>`;
        }

        function profileScreenHTML(asOverlay){
          return `
          <div id="profile-screen-root">
            <div class="px-5 pb-3 flex items-center justify-between" style="padding-top:var(--top-safe-pad);">
              ${asOverlay
                ? `<button onclick="closeOverlay()" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('back','w-5 h-5'))}</button>`
                : `<button onclick="openOverlay('create')" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('plus','w-6 h-6'))}</button>`}
              <span id="profile-username-el" class="nm-wrap font-bold text-base font-display" style="flex:1;min-width:0;font-size:16px;">${profileUsernameHTML()}</span>
              <div class="flex items-center rounded-full" style="background:rgba(65,105,225,0.08)">
                <button onclick="openOverlay('profileMenu')" class="w-8 h-8 flex items-center justify-center">${gradIcon(IconBold('settings','w-4 h-4'))}</button>
              </div>
            </div>

            <div id="profile-load-banner-el">${profileLoadBannerHTML()}</div>
            <div class="p-5">
              <div class="flex items-center gap-5 mb-4">
                <div class="relative flex-shrink-0">
                  ${profilePhotoButtonHTML()}
                </div>
                <div class="flex-1">
                  <div id="profile-name-el" class="font-bold text-base mb-2">${profileNameHTML()}</div>
                  <div class="flex items-start gap-6">
                    <div class="text-left"><div class="text-base font-bold" id="profile-posts-count-el">${myPostsCount()}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Posts</div></div>
                    <button onclick="openOverlay('myContacts')" class="text-left"><div class="text-base font-bold" id="profile-network-count-el">${networkConnectionCount()}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">My Network</div></button>
                  </div>
                </div>
              </div>

              <div id="profile-bio-el" class="text-sm text-gray-600 mb-4">${escapeHtml(profileData.bio)}</div>
              <div id="profile-links-el">${profileLinksHTML(profileData.links)}</div>

              <div class="flex gap-3 mb-2">
                <button onclick="openEditProfileModal()" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">Edit profile</button>
                <button onclick="openOverlay('profileQR')" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">Share profile</button>
              </div>
              <div id="profile-admin-btn-el">${profileAdminDashboardButtonHTML()}</div>
            </div>

            <div class="flex border-t border-gray-200" id="profile-tabs">${profileTabsHTML()}</div>
            <div class="px-5" id="profile-tab-content">${profileTabContent()}</div>
          </div>`;
        }

        // "View full profile" normally jumps to the main Profile tab (switchTab(4)), but that
        // fully leaves whatever tab the person was on
        function myProfileOverlayHTML(){
          return `<div class="absolute inset-0 overflow-y-auto bg-white no-scrollbar">${profileScreenHTML(true)}</div>`;
        }

        function viewMyFullProfile(){
          closeRightPanel();
          if (typeof currentTab !== 'undefined' && currentTab === 2) {
            openOverlay('myFullProfile');
          } else {
            switchTab(4);
          }
        }

        let profileTab = 'posts';

        function profileTabsHTML(){
          const tabBtn = (key, icon) => `
            <button type="button" onclick="profileTabSwitch('${key}')" class="flex-1 flex justify-center py-3 ${profileTab === key ? `border-b-2 border-[${ROYAL}] text-[${NAVY}]` : 'text-gray-400'}" style="cursor:pointer;">${Icon(icon + 'Outline','w-5 h-5')}</button>`;
          return tabBtn('posts','grid') + tabBtn('reposts','repost') + tabBtn('saved','bookmark');
        }

        function profileGridItem(post, source){
          // A post still being uploaded has no mediaHtml yet
          if (post.uploading) {
            return `<div class="relative w-full aspect-square overflow-hidden bg-gray-100" style="border-radius:0;">${uploadingMediaSkeletonHtml(post.uploadCount || 1)}</div>`;
          }
          const isMulti = !!(post.mediaHtml && /post-media-grid/.test(post.mediaHtml));
          let inner;
          let mediaType = null; 
          if (isMulti) {
            const firstTag = post.mediaHtml.match(/<(img|video)[^>]*\ssrc="([^"]+)"[^>]*>/i);
            if (firstTag) {
              mediaType = firstTag[1].toLowerCase() === 'video' ? 'video' : 'photo';
              inner = firstTag[0];
            } else {
              // Couldn't pull out the first tile's tag
              mediaType = 'photo';
              inner = post.mediaHtml;
            }
          } else if (post.mediaHtml) {
            const videoMatch = post.mediaHtml.match(/<video[^>]*\ssrc="([^"]+)"/i);
            if (videoMatch) {
              mediaType = 'video';
              inner = `<video src="${videoMatch[1]}" class="w-full h-full object-cover pointer-events-none" muted playsinline preload="metadata"></video>`;
            } else {
              mediaType = 'photo';
              inner = post.mediaHtml;
            }
          } else {
            inner = `<div class="w-full h-full bg-gray-100 flex items-center justify-center p-2"><div class="text-[9px] leading-tight text-gray-500 text-center overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${post.body||''}</div></div>`;
          }
          // Badge sits on a small dark pill (not just a drop-shadowed icon) so it reads clearly over
          // bright/white photos too, and a title attribute spells it out for anyone hovering on
          const typeBadge = mediaType ? `<div class="absolute bottom-1.5 right-1.5 text-white flex items-center justify-center" title="${mediaType === 'video' ? 'Video' : 'Photo'}" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${Icon(mediaType === 'video' ? 'play' : 'photoFrame','w-4 h-4')}</div>` : '';
          return `<div onclick="openPostFeedFrom('${source||'mine'}', ${post.id})" class="relative w-full aspect-square overflow-hidden bg-gray-100" style="border-radius:0;cursor:pointer;">${inner}${isMulti ? `<div class="absolute top-1.5 right-1.5 text-white" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));" title="Multiple items">${Icon('copy','w-4 h-4')}</div>` : ''}${typeBadge}</div>`;
        }

        function byNewestFirst(a, b){
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        }

        function profileTabContent(){
          const emptyState = (text) => `<div class="text-gray-400 text-sm text-center py-10">${text}</div>`;
          if (profileTab === 'reposts') {
            const items = feedPosts.filter(p => p.reposted).sort(byNewestFirst);
            return items.length ? `<div class="profile-thumb-grid">${items.map(p => profileGridItem(p,'reposts')).join('')}</div>` : emptyState('Posts you repost will show up here.');
          }
          if (profileTab === 'saved') {
            const items = feedPosts.filter(p => p.saved).sort(byNewestFirst);
            return items.length ? `<div class="profile-thumb-grid">${items.map(p => profileGridItem(p,'saved')).join('')}</div>` : emptyState('Posts you save will show up here.');
          }
          // Excludes repost cards (see myPostsCount in feed.js) so the "Posts" grid and its count
          // always agree with each other and with what shows up as your own uploads in the main
          const items = feedPosts.filter(p => p.mine && !p.isRepost).sort(byNewestFirst);
          return items.length ? `<div class="profile-thumb-grid">${items.map(p => profileGridItem(p,'mine')).join('')}</div>` : emptyState('Your posts will show up here.');
        }

        let rightPanelMode = null; 

        // ---- Desktop right panel (profile/discover/notebook/job-plan) ----
        function openRightPanel(mode, syncNav){
          const appShellForCheck = document.getElementById('app-shell');
          if (appShellForCheck && appShellForCheck.classList.contains('messaging-split')) return;
          rightPanelMode = mode;
          if (mode === 'profile' || mode === 'discover') { if (!discoverPeopleLoaded) loadDiscoverPeople(); }
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.add('right-panel-open');
          if (syncNav !== false) {
            const dnav4 = document.getElementById('dnav-4');
            if (dnav4) dnav4.classList.toggle('dnav-active', mode === 'profile');
            if (mode === 'profile') {
              for (let i = 0; i < 4; i++) {
                const el = document.getElementById('dnav-' + i);
                if (el) el.classList.remove('dnav-active');
              }
            }
          }
          renderRightPanelBody();
        }

        function closeRightPanel(){
          rightPanelMode = null;
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) { appShellEl.classList.remove('right-panel-open'); appShellEl.classList.remove('rp-collapsed'); }
          const dnav4 = document.getElementById('dnav-4');
          if (dnav4) dnav4.classList.remove('dnav-active');
        }

        function collapseRightPanel(){
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.add('rp-collapsed');
        }

        function expandRightPanel(){
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.remove('rp-collapsed');
        }

        function toggleRightPanelCollapse(){
          const appShellEl = document.getElementById('app-shell');
          if (!appShellEl) return;
          appShellEl.classList.toggle('rp-collapsed');
        }

        const RP_MIN_WIDTH = 340;
        const RP_MAX_WIDTH = 760;
        const RP_DEFAULT_WIDTH = 480;

        function setRPWidth(px){
          const clamped = Math.max(RP_MIN_WIDTH, Math.min(RP_MAX_WIDTH, Math.round(px)));
          document.documentElement.style.setProperty('--rp-width', clamped + 'px');
          return clamped;
        }

        function rpStartDrag(e){
          if (e.cancelable) e.preventDefault();
          const panel = document.getElementById('desktop-right-panel');
          const resizer = document.getElementById('rp-resizer');
          if (panel) panel.classList.add('rp-dragging');
          if (resizer) resizer.classList.add('rp-dragging');
          document.body.style.userSelect = 'none';
          const move = (ev) => {
            const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
            setRPWidth(window.innerWidth - x);
          };
          const up = () => {
            if (panel) panel.classList.remove('rp-dragging');
            if (resizer) resizer.classList.remove('rp-dragging');
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
          window.addEventListener('touchmove', move, { passive: true });
          window.addEventListener('touchend', up);
        }

        function rightPanelTitle(){
          if (rightPanelMode === 'profile') return 'Profile';
          if (rightPanelMode === 'discover') return 'Discover';
          if (rightPanelMode === 'notebook') return inLectureCall ? 'Class Pad' : (inExamAnnotate ? 'Annotate' : 'Notebook');
          if (rightPanelMode === 'jobplan') return 'Job Plan';
          if (rightPanelMode === 'gameprofile') return 'Gaming Profile';
          if (rightPanelMode === 'aihistory') return 'Chat History';
          if (rightPanelMode === 'pinned') return 'Pinned Messages';
          if (rightPanelMode === 'file') return (lecturePreview && lecturePreview.name) || 'File';
          return '';
        }

        function renderRightPanelBody(){
          const body = document.getElementById('desktop-right-panel-body');
          const headerBar = document.getElementById('desktop-right-panel-header');
          const title = document.getElementById('desktop-right-panel-title');
          const actions = document.getElementById('desktop-right-panel-actions');
          if (headerBar) headerBar.style.display = (rightPanelMode === 'file') ? 'none' : '';
          if (title) title.textContent = rightPanelTitle();
          if (actions) {
            const modeActionsHTML = (rightPanelMode === 'aihistory') ? rightPanelAIHistoryActionsHTML() : '';
            actions.innerHTML = `<div class="flex items-center gap-1">${modeActionsHTML}</div>`;
          }
          if (!body) return;
          if (rightPanelMode === 'profile') body.innerHTML = rightPanelProfileHTML();
          else if (rightPanelMode === 'discover') body.innerHTML = rightPanelDiscoverHTML();
          else if (rightPanelMode === 'notebook') body.innerHTML = rightPanelNotebookHTML();
          else if (rightPanelMode === 'jobplan') body.innerHTML = rightPanelJobPlanHTML();
          else if (rightPanelMode === 'gameprofile') body.innerHTML = rightPanelGameProfileHTML();
          else if (rightPanelMode === 'aihistory') body.innerHTML = rightPanelAIHistoryHTML();
          else if (rightPanelMode === 'pinned') body.innerHTML = rightPanelPinnedHTML();
          else if (rightPanelMode === 'file') {
            body.innerHTML = lecturePreviewHTML();
            if (lecturePreview && lecturePreview.kind === 'pdf' && lecturePreview.status === 'ready') renderPreviewPdfPage();
          } else body.innerHTML = '';
        }

        function rightPanelProfileHTML(){
          return `
            <div class="p-5 text-center border-b border-gray-100">
              <div class="font-bold text-base mb-1">${escapeHtml(profileData.name)}</div>
              <div class="text-xs text-gray-500 mb-4">${escapeHtml(profileData.username)}</div>
              <div class="flex items-center justify-center gap-6 mb-4">
                <div class="text-center"><div class="text-base font-bold">${myPostsCount()}</div><div class="text-[11px] text-gray-500">Posts</div></div>
                <button onclick="openOverlay('myContacts')" class="text-center"><div class="text-base font-bold">${networkConnectionCount()}</div><div class="text-[11px] text-gray-500">My Network</div></button>
              </div>
              ${profileData.bio ? `<div class="text-sm text-gray-600 mb-4">${escapeHtml(profileData.bio)}</div>` : ''}
              ${profileLinksHTML(profileData.links, { center: true })}
              <div class="flex gap-2">
                <button onclick="viewMyFullProfile()" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">View full profile</button>
                <button onclick="openEditProfileModal()" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">Edit</button>
              </div>
            </div>
            <div class="px-5 pt-4 pb-5">
              <div class="font-semibold text-sm mb-3">Discover friends</div>
              <div id="discover-people-list">${discoverPeopleHTML()}</div>
            </div>`;
        }

        function rightPanelDiscoverHTML(){
          return `
            <div class="px-5 pb-5">
              <div class="sticky top-0 z-10 bg-white pt-5 pb-3" style="background:var(--panel-bg,#fff);padding-bottom:calc(0.75rem + 5px);">
                <input id="discover-search-input" value="${escapeHtml(discoverSearchQuery)}" oninput="onDiscoverSearchInput(this.value)" placeholder="Search by name, school, field..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm" autocomplete="off">
              </div>
              <div id="discover-people-list">${discoverPeopleHTML()}</div>
            </div>`;
        }

        let notebookNotes = [];
        let notebookDraft = '';
        let notebookExpandedIds = new Set();

        function classPadBodyHTML(prefix){
          return `
            <textarea id="${prefix}-notebook-draft-input" oninput="notebookDraft=this.value" placeholder="Jot a quick note for this class..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3 resize-none" rows="3">${escapeHtml(notebookDraft)}</textarea>
            <button onclick="addNotebookNote()" class="w-full py-2.5 rounded-full font-medium text-sm text-white mb-5" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Add note</button>
            <div class="font-semibold text-sm text-gray-700 mb-3">${inLectureCall ? 'Class Pad' : (inExamAnnotate ? 'Annotate' : 'Notebook')}</div>
            <div id="${prefix}-notebook-notes-list">${notebookNotesHTML()}</div>
            ${inLectureCall ? `
            <div id="${prefix}-classpad-resources-list">${classPadResourcesHTML()}</div>
            <div id="${prefix}-classpad-uploaded-list">${classPadUploadedResourcesHTML()}</div>` : ''}`;
        }

        function rightPanelNotebookHTML(){
          return `<div class="p-5">${classPadBodyHTML('desktop')}</div>`;
        }

        function notebookNotesHTML(){
          if (!notebookNotes.length) return `<div class="text-gray-400 text-sm text-center py-10">Notes you jot down during class will show up here.</div>`;
          return notebookNotes.map(n => {
            const expanded = notebookExpandedIds.has(n.id);
            return `
            <div onclick="toggleNotebookNote('${n.id}')" class="bg-gray-50 rounded-2xl p-4 mb-3 cursor-pointer">
              <div class="text-sm text-gray-700 mb-2 ${expanded ? '' : 'truncate'}" style="${expanded ? 'white-space:pre-wrap;' : ''}">${escapeHtml(n.text)}</div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400">${n.time}</span>
                <button onclick="event.stopPropagation(); deleteNotebookNote('${n.id}')" class="text-gray-400">${Icon('trash','w-3.5 h-3.5')}</button>
              </div>
            </div>`;
          }).join('');
        }

        function refreshClassPadSurfaces(){
          ['desktop','lecture'].forEach(prefix => {
            const list = document.getElementById(`${prefix}-notebook-notes-list`);
            if (list) list.innerHTML = notebookNotesHTML();
            const draft = document.getElementById(`${prefix}-notebook-draft-input`);
            if (draft) draft.value = notebookDraft;
          });
        }

        // ---- Notebook notes (right panel) ----
        function toggleNotebookNote(id){
          if (notebookExpandedIds.has(id)) notebookExpandedIds.delete(id);
          else notebookExpandedIds.add(id);
          refreshClassPadSurfaces();
        }

        function addNotebookNote(){
          const text = notebookDraft.trim();
          if (!text) return;
          const id = 'note-' + Date.now();
          notebookNotes.unshift({ id, text, time: 'Just now' });
          notebookExpandedIds.add(id);
          notebookDraft = '';
          refreshClassPadSurfaces();
          saveUserNotes();
        }

        function deleteNotebookNote(id){
          notebookNotes = notebookNotes.filter(n => n.id !== id);
          notebookExpandedIds.delete(id);
          refreshClassPadSurfaces();
          saveUserNotes();
        }

        let jobPlanNotes = [];
        let jobPlanDraft = '';
        let jobPlanExpandedIds = new Set();

        // ---- Job-plan notes (right panel) ----
        function rightPanelJobPlanHTML(){
          return `
            <div class="p-5">
              <textarea id="jobplan-draft-input" oninput="jobPlanDraft=this.value" placeholder="Jot a tip or note on a job or application..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3 resize-none" rows="3">${escapeHtml(jobPlanDraft)}</textarea>
              <button onclick="addJobPlanNote()" class="w-full py-2.5 rounded-full font-medium text-sm text-white mb-5" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Add note</button>
              <div id="jobplan-notes-list">${jobPlanNotesHTML()}</div>
            </div>`;
        }

        function jobPlanNotesHTML(){
          if (!jobPlanNotes.length) return `<div class="text-gray-400 text-sm text-center py-10">Tips and notes you jot down on jobs will show up here.</div>`;
          return jobPlanNotes.map(n => {
            const expanded = jobPlanExpandedIds.has(n.id);
            return `
            <div onclick="toggleJobPlanNote('${n.id}')" class="bg-gray-50 rounded-2xl p-4 mb-3 cursor-pointer">
              <div class="text-sm text-gray-700 mb-2 ${expanded ? '' : 'truncate'}" style="${expanded ? 'white-space:pre-wrap;' : ''}">${escapeHtml(n.text)}</div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400">${n.time}</span>
                <button onclick="event.stopPropagation(); deleteJobPlanNote('${n.id}')" class="text-gray-400">${Icon('trash','w-3.5 h-3.5')}</button>
              </div>
            </div>`;
          }).join('');
        }

        function toggleJobPlanNote(id){
          if (jobPlanExpandedIds.has(id)) jobPlanExpandedIds.delete(id);
          else jobPlanExpandedIds.add(id);
          const list = document.getElementById('jobplan-notes-list');
          if (list) list.innerHTML = jobPlanNotesHTML();
        }

        function addJobPlanNote(){
          const text = jobPlanDraft.trim();
          if (!text) return;
          const id = 'jplan-' + Date.now();
          jobPlanNotes.unshift({ id, text, time: 'Just now' });
          jobPlanExpandedIds.add(id);
          jobPlanDraft = '';
          const body = document.getElementById('desktop-right-panel-body');
          if (body) body.innerHTML = rightPanelJobPlanHTML();
          saveUserNotes();
        }

        function deleteJobPlanNote(id){
          jobPlanNotes = jobPlanNotes.filter(n => n.id !== id);
          jobPlanExpandedIds.delete(id);
          const list = document.getElementById('jobplan-notes-list');
          if (list) list.innerHTML = jobPlanNotesHTML();
          saveUserNotes();
        }

        async function saveUserNotes(){
          queueSaveUserState();
        }

        async function loadUserNotes(){
          await ensureUserStateLoaded();
        }

        function refreshProfilePostsUI(){
          const postsCountEl = document.getElementById('profile-posts-count-el');
          if (postsCountEl) postsCountEl.textContent = myPostsCount();
          const content = document.getElementById('profile-tab-content');
          if (content && typeof profileTabContent === 'function') {
            content.innerHTML = profileTabContent();
            lastRenderedProfileGridKey = profileTabContentKey();
          }
        }

        function profileTabSwitch(tab){
          if (tab === profileTab) return;
          profileTab = tab;
          const bar = document.getElementById('profile-tabs');
          if (bar) bar.innerHTML = profileTabsHTML();
          const content = document.getElementById('profile-tab-content');
          if (content) {
            content.innerHTML = profileTabContent();
            lastRenderedProfileGridKey = profileTabContentKey();
          }
        }

        // ---- Bio/field editing + profile links ----
        function editField(id, label, value, placeholder){
          return `
            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">${label}</label>
              <input id="${id}" type="text" value="${value||''}" placeholder="${placeholder||''}" class="w-full text-[15px] border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3" style="outline:none;">
            </div>`;
        }

        function editBioField(id, label, value, placeholder){
          return `
            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">${label}</label>
              <textarea id="${id}" placeholder="${placeholder||''}" oninput="autoResizeBio(this)" rows="1" class="w-full text-[15px] resize-none overflow-hidden border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3" style="min-height:48px;line-height:1.4;transition:height .12s ease;outline:none;">${value||''}</textarea>
            </div>`;
        }

        function autoResizeBio(el){
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
        }

        function normalizeProfileLinkUrl(raw){
          const trimmed = (raw || '').trim();
          if (!trimmed) return '';
          if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
          return 'https://' + trimmed;
        }

        function profileLinkDisplayLabel(url){
          try {
            const u = new URL(url);
            const host = u.hostname.replace(/^www\./, '');
            const path = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '';
            return host + path;
          } catch (e) {
            return (url || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
          }
        }

        function profileLinksHTML(links, opts){
          const list = Array.isArray(links) ? links.filter(l => l && l.url) : [];
          if (!list.length) return '';
          const align = (opts && opts.center) ? 'justify-center' : '';
          return `<div class="flex flex-wrap gap-2 mb-4 ${align}">${list.map(l => `
            <a href="${escapeForJsAttr(l.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="inline-flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-3 py-1.5 rounded-full" style="background:rgba(65,105,225,0.1);color:${ROYAL};">
              ${Icon('link','w-3 h-3')}${escapeHtml(profileLinkDisplayLabel(l.url))}
            </a>`).join('')}</div>`;
        }

        function profileLinksEditHTML(){
          const list = Array.isArray(profileData.links) ? profileData.links : [];
          return `
            <div class="flex flex-wrap gap-2 mb-3">
              ${list.map(l => `
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-1.5 py-1.5 rounded-full" style="background:rgba(65,105,225,0.1);color:${ROYAL};">
                  ${Icon('link','w-3 h-3')}${escapeHtml(profileLinkDisplayLabel(l.url))}
                  <button type="button" onclick="removeProfileLink('${escapeForJsAttr(l.id)}')" class="w-4 h-4 flex items-center justify-center rounded-full" style="background:rgba(65,105,225,0.18);">${Icon('close','w-2.5 h-2.5')}</button>
                </span>`).join('')}
              <button type="button" onclick="toggleAddProfileLinkRow()" class="inline-flex items-center gap-1.5 text-xs font-semibold px-1 py-1.5" style="color:${ROYAL};">${Icon('plus','w-3 h-3')}Add link</button>
            </div>
            ${addProfileLinkRowOpen ? profileLinksAddRowHTML() : ''}`;
        }

        const profileMenuScrollCleanup = { gender: null, pronouns: null };
        function armProfileMenuScrollCloser(scrollEl, isOpen, key, onClose){
          if (profileMenuScrollCleanup[key]) {
            profileMenuScrollCleanup[key]();
            profileMenuScrollCleanup[key] = null;
          }
          if (!isOpen || !scrollEl) return;
          const anchor = scrollEl.scrollTop;
          let armed = false;
          const armTimer = setTimeout(() => { armed = true; }, 300);
          const onScroll = () => {
            if (armed && Math.abs(scrollEl.scrollTop - anchor) > 4) {
              cleanup();
              onClose();
            }
          };
          function cleanup(){
            clearTimeout(armTimer);
            scrollEl.removeEventListener('scroll', onScroll);
            if (profileMenuScrollCleanup[key] === cleanup) profileMenuScrollCleanup[key] = null;
          }
          scrollEl.addEventListener('scroll', onScroll, { passive: true });
          profileMenuScrollCleanup[key] = cleanup;
        }
        function clearProfileMenuScrollListeners(){
          if (profileMenuScrollCleanup.gender) { profileMenuScrollCleanup.gender(); profileMenuScrollCleanup.gender = null; }
          if (profileMenuScrollCleanup.pronouns) { profileMenuScrollCleanup.pronouns(); profileMenuScrollCleanup.pronouns = null; }
        }

        let addProfileLinkRowOpen = false;
        let newProfileLinkValue = '';
        let newProfileLinkError = '';

        function profileLinksAddRowHTML(){
          return `
            <div class="flex items-center gap-2 mb-3">
              <input id="new-profile-link-input" type="text" value="${escapeHtml(newProfileLinkValue)}" oninput="newProfileLinkValue=this.value" placeholder="yourwebsite.com/yourname" class="flex-1 min-w-0 text-[15px] border ${newProfileLinkError ? 'border-red-400' : 'border-gray-200'} bg-gray-50 rounded-2xl px-3 py-2.5" style="outline:none;">
              <button type="button" onclick="addProfileLink()" class="flex-shrink-0 px-3 py-2.5 rounded-full font-semibold text-sm text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Add</button>
            </div>
            ${newProfileLinkError ? `<div class="text-xs font-medium text-red-500 -mt-2 mb-3 px-1">${newProfileLinkError}</div>` : ''}`;
        }

        function toggleAddProfileLinkRow(){
          addProfileLinkRowOpen = !addProfileLinkRowOpen;
          newProfileLinkValue = '';
          newProfileLinkError = '';
          renderEditProfileForm();
          if (addProfileLinkRowOpen) {
            const input = document.getElementById('new-profile-link-input');
            if (input) input.focus();
          }
        }

        function addProfileLink(){
          const url = normalizeProfileLinkUrl(newProfileLinkValue);
          if (!url) { newProfileLinkError = 'Add a link first.'; renderEditProfileForm(); return; }
          try { new URL(url); } catch (e) { newProfileLinkError = "That doesn't look like a valid link."; renderEditProfileForm(); return; }
          if (!Array.isArray(profileData.links)) profileData.links = [];
          profileData.links.push({ id: 'link-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), url });
          newProfileLinkValue = '';
          newProfileLinkError = '';
          addProfileLinkRowOpen = false;
          syncPublicProfile();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
          renderEditProfileForm();
        }

        function removeProfileLink(id){
          if (!Array.isArray(profileData.links)) return;
          profileData.links = profileData.links.filter(l => l.id !== id);
          syncPublicProfile();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
          renderEditProfileForm();
        }

        // ---- Full "Edit Profile" modal ----
        function captureEditProfileFieldDraft(){
          const nameEl = document.getElementById('edit-name');
          const usernameEl = document.getElementById('edit-username');
          const bioEl = document.getElementById('edit-bio');
          if (nameEl) profileData.name = nameEl.value;
          if (usernameEl) profileData.username = usernameEl.value;
          if (bioEl) profileData.bio = bioEl.value;
        }

        function renderEditProfileForm(){
          const content = document.getElementById('editProfileModalContent');
          if (!content) return;
          content.innerHTML = editProfileHTML();
          const bio = document.getElementById('edit-bio');
          if (bio) autoResizeBio(bio);
          const modalEl = document.getElementById('editProfileModal');
          armProfileMenuScrollCloser(modalEl, genderMenuOpen, 'gender', () => { genderMenuOpen = false; renderEditProfileForm(); });
          armProfileMenuScrollCloser(modalEl, pronounsMenuOpen, 'pronouns', () => { pronounsMenuOpen = false; renderEditProfileForm(); });
        }

        let genderMenuOpen = false;
        let pronounsMenuOpen = false;
        let editProfileAvatarPickerOpen = false;
        let editUsernameError = '';
        let editNameError = '';

        async function isUsernameTaken(username){
          const clean = (username || '').trim().toLowerCase();
          if (!clean) return false;
          if (clean === (profileData.username || '').trim().toLowerCase()) return false;
          const sb = getSupabaseClient();
          if (!sb) return false; 
          try {
            const user = await getCachedAuthUser();
            const likeSafe = clean.replace(/[\\%_]/g, ch => '\\' + ch);
            let query = sb.from(PUBLIC_PROFILES_TABLE).select('user_id').ilike('username', likeSafe).limit(1);
            if (user) query = query.neq('user_id', user.id);
            const { data, error } = await query;
            if (error) return false; 
            return Array.isArray(data) && data.length > 0;
          } catch (e) {
            return false;
          }
        }

        function normalizeIdentityValue(value){
          return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        function isReservedStitchIdentity(value){
          return normalizeIdentityValue(value).includes('stitch');
        }

        function editProfileHTML(){
          const p = profileData;
          // Same broken-image fallback as profilePhotoButtonHTML above: an image that fails to load
          // falls back to the plain silhouette instead of showing a broken-image icon
          const avatarInner = p.photo
            ? `<img src="${p.photo}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="w-full h-full items-center justify-center" style="display:none;">${Icon('user','w-8 h-8')}</div>`
            : Icon('user','w-8 h-8');
          return `
            <div class="mb-5">
              <div class="flex items-center justify-between gap-3 pb-1">
                <button onclick="discardEditProfileChanges()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display grad-text text-right">Edit Profile</div>
              </div>
              <div class="text-sm text-gray-500 text-left mt-1">Update how your profile appears on Stitch.</div>
            </div>
            <div class="flex items-center gap-4 mb-5">
              <button onclick="viewProfilePhoto()" class="relative w-20 h-20 flex-shrink-0">
                <div class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style="color:${NAVY};background:rgba(10,37,64,0.14);">${avatarInner}</div>
              </button>
              <div class="flex flex-col items-start gap-1">
                <button onclick="triggerProfilePhotoUpload()" class="text-sm font-semibold" style="color:${ROYAL}">Upload picture</button>
                ${p.photo ? `<button onclick="deleteProfilePicture()" class="text-sm font-semibold text-red-500">Delete profile picture</button>` : ''}
                <div class="text-sm text-gray-500">${p.photo ? 'Tap your photo to view it' : 'No profile photo added yet'}</div>
              </div>
            </div>

            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">Full name</label>
              <input id="edit-name" type="text" value="${escapeHtml(p.name||'')}" oninput="onEditNameInput()" class="w-full text-[15px] border ${editNameError ? 'border-red-400' : 'border-gray-200'} bg-gray-50 rounded-2xl px-4 py-3" style="outline:none;">
              ${editNameError ? `<div class="text-xs font-medium text-red-500 mt-1.5 px-1">${editNameError}</div>` : ''}
            </div>
            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">Username</label>
              <input id="edit-username" type="text" value="${escapeHtml(p.username||'')}" oninput="onEditUsernameInput()" class="w-full text-[15px] border ${editUsernameError ? 'border-red-400' : 'border-gray-200'} bg-gray-50 rounded-2xl px-4 py-3" style="outline:none;">
              ${editUsernameError ? `<div class="text-xs font-medium text-red-500 mt-1.5 px-1">${editUsernameError}</div>` : ''}
            </div>

            ${editBioField('edit-bio','Bio', p.bio, 'Write something about yourself')}

            <div class="mb-5">
              <label class="text-sm font-bold text-gray-700 block mb-2">Links</label>
              ${profileLinksEditHTML()}
            </div>

            <div class="flex gap-3">
              <button id="edit-profile-cancel-btn" onclick="cancelEditProfileWithSpinner()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm flex items-center justify-center gap-2">Cancel</button>
              <button id="edit-profile-save-btn" onclick="saveEditProfile()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm flex items-center justify-center gap-2" style="white-space:nowrap;">Save Changes</button>
            </div>`;
        }

        let editProfileSnapshot = null;
        let editProfilePendingPhotoDelete = false;

        function snapshotProfileForEdit(){
          return {
            name: profileData.name,
            username: profileData.username,
            bio: profileData.bio,
            photo: profileData.photo,
            pronouns: profileData.pronouns,
            gender: profileData.gender,
            links: Array.isArray(profileData.links) ? profileData.links.slice() : profileData.links,
          };
        }

        function openEditProfileModal(){
          genderMenuOpen = false;
          pronounsMenuOpen = false;
          clearProfileMenuScrollListeners();
          editUsernameError = '';
          editNameError = '';
          editProfileAvatarPickerOpen = false;
          editProfilePendingPhotoDelete = false;
          editProfileSnapshot = snapshotProfileForEdit();
          renderEditProfileForm();
          const modal = document.getElementById('editProfileModal');
          if (modal) modal.classList.remove('hidden');
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => discardEditProfileChanges(fromPopState));
        }

        let cancellingEditProfile = false;
        function cancelEditProfileWithSpinner(){
          if (cancellingEditProfile) return;
          cancellingEditProfile = true;
          const btn = document.getElementById('edit-profile-cancel-btn');
          const save = document.getElementById('edit-profile-save-btn');
          if (save) { save.disabled = true; save.style.pointerEvents = 'none'; save.style.opacity = '0.7'; }
          if (btn) {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.innerHTML = `<span style="width:15px;height:15px;border-radius:50%;border:2px solid rgba(10,37,64,0.25);border-top-color:${NAVY};animation:classroom-spin .7s linear infinite;flex-shrink:0;"></span>Cancel`;
          }
          setTimeout(function(){
            cancellingEditProfile = false;
            discardEditProfileChanges();
          }, 2000);
        }

        async function discardEditProfileChanges(fromPopState){
          if (pendingProfilePhotoUpload) { await pendingProfilePhotoUpload; pendingProfilePhotoUpload = null; }
          // Whether the photo actually changed while this modal was open
          const photoChanged = !!editProfileSnapshot && profileData.photo !== editProfileSnapshot.photo;
          const hadPendingDelete = editProfilePendingPhotoDelete;
          if (editProfileSnapshot) {
            profileData.name = editProfileSnapshot.name;
            profileData.username = editProfileSnapshot.username;
            profileData.bio = editProfileSnapshot.bio;
            // profileData.photo intentionally left alone -- see note above.
            profileData.pronouns = editProfileSnapshot.pronouns;
            profileData.gender = editProfileSnapshot.gender;
            profileData.links = editProfileSnapshot.links;
          }
          if (hadPendingDelete) deleteProfilePhotoFromStorage();
          editProfileSnapshot = null;
          editProfilePendingPhotoDelete = false;
          if (photoChanged || hadPendingDelete) {
            queueSaveUserState();
            syncPublicProfile();
            refreshProfilePhotoEverywhere();
          }
          closeEditProfileModal(fromPopState);
        }

        function closeEditProfileModal(fromPopState){
          const modal = document.getElementById('editProfileModal');
          if (modal) modal.classList.add('hidden');
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
          const content = document.getElementById('editProfileModalContent');
          if (content) content.innerHTML = '';
          genderMenuOpen = false;
          pronounsMenuOpen = false;
          clearProfileMenuScrollListeners();
          editUsernameError = '';
          editNameError = '';
          editProfileAvatarPickerOpen = false;
        }

        // ---- Profile photo viewing, upload, and cropping ----
        function viewProfilePhoto(url, name){
          const src = url || profileData.photo;
          if (!src) return;
          const img = document.getElementById('profilePhotoViewerImg');
          if (img) img.src = src;
          const nameEl = document.getElementById('profilePhotoViewerName');
          if (nameEl) nameEl.textContent = name || profileData.name || '';
          const modal = document.getElementById('profilePhotoViewerModal');
          if (modal) modal.classList.remove('hidden');
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeProfilePhotoViewer(fromPopState));
        }

        function closeProfilePhotoViewer(fromPopState){
          const modal = document.getElementById('profilePhotoViewerModal');
          if (modal) modal.classList.add('hidden');
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        function triggerProfilePhotoUpload(){
          const input = document.getElementById('profile-photo-input');
          if (input) input.click();
        }

        function handleProfilePhotoSelected(e){
          const file = e.target.files && e.target.files[0];
          e.target.value = ''; 
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){ openPhotoCropModal(ev.target.result); };
          reader.readAsDataURL(file);
        }

        let profilePhotoCropper = null;

        function openPhotoCropModal(dataUrl){
          const modal = document.getElementById('photoCropModal');
          const img = document.getElementById('cropperImage');
          if (!modal || !img) return;
          modal.classList.remove('hidden');
          const slider = document.getElementById('cropZoomSlider');
          if (slider) slider.value = 0;
          img.src = dataUrl;
          const start = () => {
            if (profilePhotoCropper) { profilePhotoCropper.destroy(); profilePhotoCropper = null; }
            profilePhotoCropper = new Cropper(img, {
              aspectRatio: 1,
              viewMode: 1,
              dragMode: 'move',
              autoCropArea: 1,
              cropBoxMovable: false,
              cropBoxResizable: false,
              toggleDragModeOnDblclick: false,
              background: false,
              guides: false,
              center: false,
              highlight: false,
            });
          };
          if (img.complete) start(); else img.onload = start;
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closePhotoCropModal(fromPopState));
        }

        function closePhotoCropModal(fromPopState){
          const modal = document.getElementById('photoCropModal');
          if (modal) modal.classList.add('hidden');
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
          if (profilePhotoCropper) { profilePhotoCropper.destroy(); profilePhotoCropper = null; }
          const img = document.getElementById('cropperImage');
          if (img) img.src = '';
        }

        function cancelPhotoCrop(){
          closePhotoCropModal();
        }

        function onCropZoomInput(value){
          if (!profilePhotoCropper) return;
          const ratio = 1 + (Number(value) / 100) * 2;
          profilePhotoCropper.zoomTo(ratio);
        }

        function refreshProfilePhotoEverywhere(){
          updateNavProfileIcon();
          const editModal = document.getElementById('editProfileModal');
          if (editModal && !editModal.classList.contains('hidden')) renderEditProfileForm();
          if (currentTab === 0) renderFeed();
          else if (currentTab === 4) renderProfile();
          // A name/photo edit made while sitting on some other tab (e.g. Classroom, Messaging, Jobs)
          // previously only reached whichever tab was live above
          if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
        }

        // Tracks the in-flight upload started by confirmPhotoCrop below, so
        // saveEditProfile/discardEditProfileChanges can wait for it instead of racing it --
        let pendingProfilePhotoUpload = null;

        function confirmPhotoCrop(){
          if (!profilePhotoCropper) { closePhotoCropModal(); return; }
          const canvas = profilePhotoCropper.getCroppedCanvas({
            width: 640, height: 640, imageSmoothingQuality: 'high',
          });
          if (!canvas) { closePhotoCropModal(); return; }
          const previousPhoto = profileData.photo;
          const previousCleared = profileData.photoCleared;
          const previewDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          profileData.photo = previewDataUrl;
          profileData.photoCleared = false;
          // A new photo replaces any earlier "delete my picture" in this same edit session
          editProfilePendingPhotoDelete = false;
          closePhotoCropModal();
          renderEditProfileForm();
          pendingProfilePhotoUpload = new Promise(resolve => {
            canvas.toBlob(blob => {
              if (!blob) { resolve(); return; }
              uploadProfilePhotoToStorage(blob).then(remoteUrl => {
                if (profileData.photo !== previewDataUrl) { resolve(); return; }
                if (!remoteUrl) {
                  // Upload failed
                  profileData.photo = previousPhoto;
                  profileData.photoCleared = previousCleared;
                  const editModalFailed = document.getElementById('editProfileModal');
                  if (editModalFailed && !editModalFailed.classList.contains('hidden')) renderEditProfileForm();
                  else refreshProfilePhotoEverywhere();
                  if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't upload your new profile picture. Check your connection and try again.");
                  resolve();
                  return;
                }
                profileData.photo = remoteUrl;
                profileData.photoCleared = false;
                editProfilePendingPhotoDelete = false;
                profileData.updatedAt = Date.now();
                const editModal = document.getElementById('editProfileModal');
                const stillStaging = editModal && !editModal.classList.contains('hidden') && editProfileSnapshot;
                if (stillStaging) {
                  renderEditProfileForm();
                } else {
                  refreshProfilePhotoEverywhere();
                  queueSaveUserState();
                  syncPublicProfile();
                }
                resolve();
              }).catch(() => { resolve(); });
            }, 'image/jpeg', 0.9);
          });
        }

        function deleteProfilePicture(){
          if (!profileData.photo) return;
          openAppConfirmModal('Delete your profile picture?', '', 'Delete', function(){
            profileData.photo = null;
            profileData.photoCleared = true;
            profileData.updatedAt = Date.now();
            editProfilePendingPhotoDelete = true;
            renderEditProfileForm();
          });
        }

        function toggleEditProfileAvatarPicker(){
          captureEditProfileFieldDraft();
          editProfileAvatarPickerOpen = !editProfileAvatarPickerOpen;
          renderEditProfileForm();
        }

        function selectEditProfileAvatar(src){
          profileData.photo = src;
          profileData.photoCleared = false;
          profileData.updatedAt = Date.now();
          editProfilePendingPhotoDelete = false;
          editProfileAvatarPickerOpen = false;
          renderEditProfileForm();
        }

        // ---- Gender/pronouns pickers + username/name validation ----
        function toggleGenderMenu(){
          captureEditProfileFieldDraft();
          genderMenuOpen = !genderMenuOpen;
          renderEditProfileForm();
        }

        function setGender(g){
          captureEditProfileFieldDraft();
          profileData.gender = g;
          genderMenuOpen = false;
          renderEditProfileForm();
        }

        function togglePronounsMenu(){
          captureEditProfileFieldDraft();
          pronounsMenuOpen = !pronounsMenuOpen;
          renderEditProfileForm();
        }

        function setPronouns(v){
          captureEditProfileFieldDraft();
          profileData.pronouns = v;
          pronounsMenuOpen = false;
          renderEditProfileForm();
        }

        const USERNAME_ALLOWED_RE = /[^A-Za-z0-9._]/g;
        const USERNAME_INVALID_RE = /[^A-Za-z0-9._]/;

        function updateEditFieldErrorUI(el, message){
          if (!el) return;
          el.classList.toggle('border-red-400', !!message);
          el.classList.toggle('border-gray-200', !message);
          let errEl = el.parentElement ? el.parentElement.querySelector('.text-red-500') : null;
          if (message) {
            if (!errEl) {
              errEl = document.createElement('div');
              errEl.className = 'text-xs font-medium text-red-500 mt-1.5 px-1';
              el.parentElement.appendChild(errEl);
            }
            errEl.textContent = message;
          } else if (errEl) {
            errEl.remove();
          }
        }

        const RESERVED_STITCH_IDENTITY_MESSAGE = '"Stitch" is reserved and can\'t be used as your username.';
        const RESERVED_STITCH_NAME_MESSAGE = '"Stitch" is reserved and can\'t be used as your name.';

        function onEditUsernameInput(){
          const el = document.getElementById('edit-username');
          if (el) {
            const cleaned = el.value.replace(USERNAME_ALLOWED_RE, '');
            if (cleaned !== el.value) {
              const pos = el.selectionStart - (el.value.length - cleaned.length);
              el.value = cleaned;
              if (el.setSelectionRange) el.setSelectionRange(pos, pos);
            }
          }
          if (el && isReservedStitchIdentity(el.value)) {
            el.value = '';
            editUsernameError = RESERVED_STITCH_IDENTITY_MESSAGE;
          } else {
            editUsernameError = '';
          }
          updateEditFieldErrorUI(el, editUsernameError);
        }

        function onEditNameInput(){
          const el = document.getElementById('edit-name');
          if (el && isReservedStitchIdentity(el.value)) {
            el.value = '';
            editNameError = RESERVED_STITCH_NAME_MESSAGE;
          } else {
            editNameError = '';
          }
          updateEditFieldErrorUI(el, editNameError);
        }

        let savingEditProfile = false;

        // Toggles the Save Changes button's spinner/disabled state by mutating that one button
        // directly, instead of re-rendering the whole edit-profile form (renderEditProfileForm)
        function setSavingEditProfileUI(saving){
          savingEditProfile = saving;
          const btn = document.getElementById('edit-profile-save-btn');
          if (!btn) return;
          btn.disabled = saving;
          btn.style.opacity = saving ? '0.7' : '';
          btn.style.pointerEvents = saving ? 'none' : '';
          btn.innerHTML = saving
            ? `<span style="width:15px;height:15px;border-radius:50%;border:2px solid rgba(10,37,64,0.25);border-top-color:${NAVY};animation:classroom-spin .7s linear infinite;flex-shrink:0;"></span>Updating`
            : 'Save Changes';
        }

        // After editing your own profile, your existing posts/comments on this device should show
        // the new name straight away (other people get it live through the public_profiles feed)
        function applyOwnProfileToLocalPosts(){
          try {
            if (typeof feedPosts === 'undefined') return;
            const uid = (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
            feedPosts.forEach(post => {
              if (post.mine && profileData.name) post.name = profileData.name;
              if (Array.isArray(post.commentsList)) post.commentsList.forEach(c => {
                if (c && uid && c.userId === uid) { if (profileData.name && c.name !== 'You') c.name = profileData.name; c.photo = profileData.photo || null; }
              });
            });
            if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
            if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof renderFeed === 'function') renderFeed();
          } catch (e) {}
        }

        async function saveEditProfile(){
          if (savingEditProfile) return;
          const nameEl = document.getElementById('edit-name');
          const usernameEl = document.getElementById('edit-username');
          const bioEl = document.getElementById('edit-bio');
          const newName = nameEl ? nameEl.value.trim() : profileData.name;
          const newUsername = usernameEl ? usernameEl.value.trim() : profileData.username;
          const newBio = bioEl ? bioEl.value.trim() : profileData.bio;
          editNameError = '';
          editUsernameError = '';
          let hasError = false;
          if (newName && isReservedStitchIdentity(newName)){
            editNameError = '"Stitch" is reserved and can\'t be used as your name.';
            hasError = true;
          }
          if (newUsername && isReservedStitchIdentity(newUsername)){
            editUsernameError = '"Stitch" is reserved and can\'t be used as your username.';
            hasError = true;
          } else if (newUsername && USERNAME_INVALID_RE.test(newUsername)){
            editUsernameError = 'Usernames can only contain letters, numbers, periods, and underscores.';
            hasError = true;
          }
          if (hasError){
            renderEditProfileForm();
            return;
          }
          // Everything past this point can involve a network round-trip (an in-progress photo
          // upload, checking username availability)
          setSavingEditProfileUI(true);
          const savingStartedAt = Date.now();
          const MIN_SAVING_SPINNER_MS = 500;
          try {
            if (pendingProfilePhotoUpload) { await pendingProfilePhotoUpload; pendingProfilePhotoUpload = null; }
            if (newUsername) {
              const taken = await isUsernameTaken(newUsername);
              if (taken) {
                editUsernameError = 'That username is already taken. Please choose another.';
                setSavingEditProfileUI(false);
                renderEditProfileForm();
                return;
              }
            }
            const elapsed = Date.now() - savingStartedAt;
            if (elapsed < MIN_SAVING_SPINNER_MS) await new Promise(r => setTimeout(r, MIN_SAVING_SPINNER_MS - elapsed));
            const previousUsername = profileData.username;
            profileData.name = newName || profileData.name;
            profileData.username = newUsername || profileData.username;
            profileData.bio = newBio;
            profileData.updatedAt = Date.now();
            if (editProfilePendingPhotoDelete) {
              deleteProfilePhotoFromStorage();
              editProfilePendingPhotoDelete = false;
            }
            // Await the actual DB write before declaring success: the earlier isUsernameTaken check is
            // only a courtesy check-then-act, not a guarantee
            const syncResult = await syncPublicProfile();
            if (!syncResult.ok && syncResult.usernameConflict) {
              profileData.username = previousUsername;
              editUsernameError = 'That username is already taken. Please choose another.';
              setSavingEditProfileUI(false);
              renderEditProfileForm();
              return;
            }
            editProfileSnapshot = null;
            queueSaveUserState();
            closeEditProfileModal();
            refreshProfilePhotoEverywhere();
            applyOwnProfileToLocalPosts();
          } finally {
            savingEditProfile = false;
          }
        }

        function autoSaveEditProfileDraft(){
          const modal = document.getElementById('editProfileModal');
          if (!modal || modal.classList.contains('hidden')) return;
          const nameEl = document.getElementById('edit-name');
          const usernameEl = document.getElementById('edit-username');
          const bioEl = document.getElementById('edit-bio');
          if (nameEl && !isReservedStitchIdentity(nameEl.value.trim())) {
            profileData.name = nameEl.value.trim() || profileData.name;
          }
          if (usernameEl && !isReservedStitchIdentity(usernameEl.value.trim())) {
            profileData.username = usernameEl.value.trim() || profileData.username;
          }
          if (bioEl) profileData.bio = bioEl.value.trim();
          profileData.updatedAt = Date.now();
          if (editProfilePendingPhotoDelete) {
            deleteProfilePhotoFromStorage();
            editProfilePendingPhotoDelete = false;
          }
          editProfileSnapshot = null;
          queueSaveUserState();
          syncPublicProfile();
          closeEditProfileModal();
          refreshProfilePhotoEverywhere();
        }

        // ---- Settings list rows (used by the profile menu) ----
        function settingsRow(icon, label, sub, onclick, danger, hideArrow, id){
          return `
            <button ${id ? `id="${id}"` : ''} onclick="${onclick}" class="w-full flex items-center gap-3 py-3 text-left">
              <div class="w-9 h-9 flex items-center justify-center ${danger ? 'text-red-500' : 'text-[#1e90ff]'} flex-shrink-0">${Icon(icon,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] ${danger ? 'text-red-500 font-medium' : 'text-gray-900'}">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              ${hideArrow ? '' : `<div class="flex-shrink-0" style="color:${NAVY}">${Icon('arrowRight','w-4 h-4')}</div>`}
            </button>`;
        }

        function settingsSection(title, rowsHtml){
          return `
            <div class="mb-5">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">${title}</div>
              <div class="rounded-2xl divide-y px-4" style="border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">${rowsHtml}</div>
            </div>`;
        }

        function settingsToggleRow(icon, label, sub, checked, onclick){
          return `
            <div class="w-full flex items-center gap-3 py-3">
              <div class="w-9 h-9 flex items-center justify-center text-[#1e90ff] flex-shrink-0">${Icon(icon,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] text-gray-900">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              <button onclick="${onclick}" class="relative flex-shrink-0" style="width:44px;height:24px;border-radius:9999px;border:1px solid ${checked ? 'transparent' : '#d1d5db'};background:${checked ? `linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)` : '#e5e7eb'};box-shadow:inset 0 1px 2px rgba(0,0,0,0.08);transition:background .15s ease;">
                <span style="position:absolute;top:1px;left:1px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);transform:translateX(${checked ? '20px' : '0'});transition:transform .15s ease;"></span>
              </button>
            </div>`;
        }

        function dangerZoneSection(rowsHtml){
          return `
            <div class="mb-3">
              <div class="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">${Icon('alertTriangle','w-3.5 h-3.5')} Danger zone</div>
              <div class="rounded-2xl border border-red-100 divide-y divide-red-100 px-4" style="background-image:linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(220,38,38,0.03) 100%);">${rowsHtml}</div>
            </div>`;
        }

        // ---- Profile QR code (generate/share/download) ----
        function profileQRLink(){
          return `https://stitch.app/@${escapeHtml(profileData.username)}`;
        }

        function profileQRHTML(){
          return `
            <div class="flex-1 flex flex-col overflow-y-auto" style="background:#ffffff;">
              <div class="flex items-center px-5 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
                <button onclick="closeOverlay()" class="text-[${NAVY}]">${IconBold('close','w-6 h-6')}</button>
              </div>
              <div class="flex-1 flex flex-col items-center px-8" style="padding-top:48px;">
                <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-xl" style="width:280px;">
                  <div id="profile-qr-code" class="relative flex items-center justify-center" style="width:240px;height:240px;">
                    <div class="absolute rounded-2xl bg-white flex items-center justify-center" style="width:52px;height:52px;box-shadow:0 0 0 5px #ffffff;">
                      <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center" style="background:linear-gradient(135deg, ${ROYAL}, ${NAVY});">
                        ${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('camera','w-5 h-5 text-white')}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex-1"></div>
                <div class="flex flex-col items-center" style="margin-bottom:50px;width:280px;">
                  <div class="font-bold text-lg font-display mb-3 tracking-wide text-[${NAVY}]">${escapeHtml(profileData.username.toUpperCase())}</div>
                  <div class="flex items-center justify-between rounded-3xl pt-2.5 pb-3 px-4 bg-white shadow-xl" style="width:280px;">
                    ${qrActionButton('send','Share','shareProfileQR()')}
                    ${qrActionButton('link','Copy','copyProfileQRLink()')}
                    ${qrActionButton('download','Download','downloadProfileQR()')}
                  </div>
                </div>
              </div>
            </div>`;
        }

        function qrActionButton(icon,label,onclick){
          return `
            <button onclick="${onclick}" class="flex flex-col items-center gap-1 text-gray-700 flex-shrink-0">
              ${Icon(icon,'w-4 h-4')}
              <span class="text-[10px] font-medium text-gray-500">${label}</span>
            </button>`;
        }

        function initProfileQRCode(){
          const el = document.getElementById('profile-qr-code');
          if (!el || typeof QRCode === 'undefined') return;
          Array.from(el.querySelectorAll('canvas, table, img')).forEach(n => n.remove());
          new QRCode(el, {
            text: profileQRLink(),
            width: 240,
            height: 240,
            colorDark: NAVY,
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
          const canvas = el.querySelector('canvas') || el.querySelector('img');
          if (canvas) canvas.style.position = 'relative';
        }

        function shareProfileQR(){
          const link = profileQRLink();
          if (navigator.share) {
            navigator.share({ title: profileData.name, text: `Check out ${escapeHtml(profileData.username)} on Stitch`, url: link }).catch(() => {});
          } else {
            copyProfileQRLink();
          }
        }

        function copyProfileQRLink(){
          const link = profileQRLink();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Link copied to clipboard')).catch(() => openAppAlertModal(link));
          } else {
            openAppAlertModal(link);
          }
        }

        function downloadProfileQR(){
          const el = document.getElementById('profile-qr-code');
          const qrCanvas = el ? el.querySelector('canvas') : null;
          if (!qrCanvas) { openAppAlertModal('QR code is still generating, try again in a moment.'); return; }
          const size = 640, pad = 60;
          const out = document.createElement('canvas');
          out.width = size; out.height = size + 140;
          const ctx = out.getContext('2d');

          const drawBaseAndSave = () => {
            const link = document.createElement('a');
            link.download = `${escapeHtml(profileData.username)}-qr.png`;
            link.href = out.toDataURL('image/png');
            link.click();
          };

          const drawBase = () => {
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, 0, 0, out.width, out.height, 36);
            ctx.fill();
            const qrSize = size - pad * 2;
            ctx.drawImage(qrCanvas, pad, pad, qrSize, qrSize);
            ctx.fillStyle = NAVY;
            ctx.font = 'bold 34px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(profileData.username.toUpperCase(), out.width / 2, size + 80);
          };

          const centerX = pad + (size - pad * 2) / 2;
          const centerY = pad + (size - pad * 2) / 2;

          const drawBadge = (img) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
            ctx.clip();
            if (img) {
              ctx.drawImage(img, centerX - 32, centerY - 32, 64, 64);
            } else {
              const grad = ctx.createLinearGradient(centerX - 32, centerY - 32, centerX + 32, centerY + 32);
              grad.addColorStop(0, ROYAL);
              grad.addColorStop(1, NAVY);
              ctx.fillStyle = grad;
              ctx.fillRect(centerX - 32, centerY - 32, 64, 64);
            }
            ctx.restore();
          };

          drawBase();
          if (profileData.photo) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { drawBadge(img); drawBaseAndSave(); };
            img.onerror = () => { drawBadge(null); drawBaseAndSave(); };
            img.src = profileData.photo;
          } else {
            drawBadge(null);
            drawBaseAndSave();
          }
        }

        function roundRect(ctx, x, y, w, h, r){
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        }

        // ---- Profile overflow menu ----
        function profileMenuHTML(){
          return `
            <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Settings and activity', '20px', null, null, {right:true})}
              <div class="p-5">
              ${settingsSection('Your account', `
                ${settingsRow('chart','Your activity', null, "openOverlayFrom('profileMenu','profileAnalytics')")}
                ${settingsRow('close','Blocked', blockedAccounts.length ? `${blockedAccounts.length} account${blockedAccounts.length===1?'':'s'}` : 'No blocked accounts', "openOverlay('blockedAccounts')")}
                ${settingsToggleRow('theme','Theme', appPrefs.theme === 'dark' ? 'Dark mode' : 'Light mode', appPrefs.theme === 'dark', "toggleTheme()")}
              `)}
              ${settingsSection('Notification Preferences', `
                ${settingsToggleRow('bell','Reminders and updates', 'Session reminders plus app news and updates', appPrefs.notifReminders, "toggleNotifPref('notifReminders')")}
                ${settingsToggleRow('comment','New messages', 'Direct messages and chat', appPrefs.notifMessages, "toggleNotifPref('notifMessages')")}
                ${settingsToggleRow('mail','Email notifications', 'Receive updates via email', appPrefs.notifEmail, "toggleNotifPref('notifEmail')")}
              `)}
              ${settingsSection('Support', `
                ${settingsRow('help','Help Center', 'FAQs and guides', "openOverlay('helpCenter')")}
                ${settingsRow('flag','Report an Issue', 'Bugs, safety, or content', "openOverlayFrom('profileMenu','reportIssue')")}
                ${settingsRow('phone','Contact Us', 'Get in touch · support.stitch.io@gmail.com', "openOverlayFrom('profileMenu','contactUs')")}
              `)}
              ${settingsSection('Data &amp; Privacy', `
                ${settingsRow('shield','Privacy Policy', null, "openOverlay('privacyPolicy')")}
                ${settingsRow('doc','Terms of Use', null, "openOverlay('termsOfService')")}
              `)}
              ${settingsSection('Account', `
                ${settingsRow('logout','Sign Out', null, "authSignOut()", false, true)}
              `)}
              ${dangerZoneSection(`
                ${settingsRow('trash','Delete Account', 'Permanently remove your account and all data', "authDeleteAccount()", true, true)}
              `)}
              </div>
            </div>`;
        }




        // ---- Edit Profile: the page is NOT scrollable. It only moves by itself, up above the keyboard
        // while the Bio or "Add link" box is focused, and drops straight back when the keyboard goes ----
        (function setupEditProfileKeyboardAvoidance(){
          const BASE_PAD = 88;
          const LIFT_IDS = ['new-profile-link-input', 'edit-bio'];
          function modalEl(){ return document.getElementById('editProfileModal'); }
          function liftFocused(){
            const m = modalEl();
            const ae = document.activeElement;
            return !!(m && ae && LIFT_IDS.indexOf(ae.id) > -1 && m.contains(ae));
          }
          function lock(m){
            m.style.overflowY = 'hidden';          // no finger-scrolling, ever
            m.style.overscrollBehavior = 'contain';
            m.style.scrollBehavior = 'auto';
          }
          function drop(m){
            lock(m);
            m.style.paddingBottom = BASE_PAD + 'px';
            m.scrollTop = 0;
          }
          function keyboardCovered(){
            const vv = window.visualViewport;
            let h = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
            const vk = navigator.virtualKeyboard;
            if (vk && vk.boundingRect) h = Math.max(h, Math.round(vk.boundingRect.height || 0));
            return h;
          }
          function lift(m){
            const ae = document.activeElement;
            const target = (ae && ae.parentElement) ? ae.parentElement : ae;
            if (!target) return;
            const covered = keyboardCovered();
            const visibleBottom = (window.innerHeight - covered) - 12;
            // room under the content so the page has somewhere to move to
            m.style.paddingBottom = (BASE_PAD + covered + 24) + 'px';
            const over = target.getBoundingClientRect().bottom - visibleBottom;
            if (over > 0) m.scrollTop += over;
          }
          function sync(){
            const m = modalEl();
            if (!m || m.classList.contains('hidden')) return;
            lock(m);
            if (liftFocused() && keyboardCovered() > 80) lift(m);
            else drop(m);
          }
          document.addEventListener('focusin', function(e){
            const m = modalEl();
            if (m && m.contains(e.target)) { sync(); [60, 150, 300, 500].forEach(function(ms){ setTimeout(sync, ms); }); }
          });
          // Keyboard going away: drop the page back down at once
          document.addEventListener('focusout', function(){
            const m = modalEl();
            if (m) drop(m);
            setTimeout(sync, 0);
          });
          if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', sync);
            window.visualViewport.addEventListener('scroll', sync);
          }
          window.addEventListener('resize', sync);
          if (navigator.virtualKeyboard) navigator.virtualKeyboard.addEventListener('geometrychange', sync);
          const mm = modalEl();
          if (mm) {
            lock(mm);
            new MutationObserver(function(){ if (!mm.classList.contains('hidden') && !liftFocused()) lock(mm); })
              .observe(mm, { childList:true, subtree:true });
          }
        })();


        // ---- Full-page screens (Match with CV/Resume steps, Contact Us, Report an issue, and the other pages that
        // open in #overlay): when a text box gets focus the page makes room above the keyboard and moves the box into
        // view; when the keyboard goes, the page drops straight back to where it was ----
        (function setupOverlayKeyboardAvoidance(){
          const GAP = 20;
          let state = null; // { sc, pad, top }
          function ovEl(){ return document.getElementById('overlay'); }
          function kbHeight(){
            const vv = window.visualViewport;
            let h = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
            const vk = navigator.virtualKeyboard;
            if (vk && vk.boundingRect) h = Math.max(h, Math.round(vk.boundingRect.height || 0));
            return h;
          }
          function isTextField(el){
            if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return false;
            if (el.tagName === 'INPUT' && /^(checkbox|radio|file|button|submit|range|color)$/i.test(el.type)) return false;
            return true;
          }
          function scrollerOf(el, root){
            for (let n = el.parentElement; n && n !== root.parentElement; n = n.parentElement) {
              const oy = getComputedStyle(n).overflowY;
              if (oy === 'auto' || oy === 'scroll') return n;
              if (n === root) break;
            }
            return null;
          }
          function release(){
            if (!state) return;
            const s = state; state = null;
            s.sc.style.paddingBottom = s.pad;
            s.sc.scrollTop = s.top;
          }
          function lift(){
            const ov = ovEl();
            const ae = document.activeElement;
            if (!ov || ov.classList.contains('hidden') || !ae || !ov.contains(ae) || !isTextField(ae)) { release(); return; }
            const kb = kbHeight();
            if (kb < 80) { release(); return; }
            const sc = scrollerOf(ae, ov);
            if (!sc) return;
            if (!state || state.sc !== sc) { release(); state = { sc: sc, pad: sc.style.paddingBottom, top: sc.scrollTop }; }
            sc.style.paddingBottom = (kb + 28) + 'px';          // room under the content so the page can move up
            const visibleBottom = window.innerHeight - kb - GAP;
            const r = ae.getBoundingClientRect();
            if (r.bottom > visibleBottom) sc.scrollTop += (r.bottom - visibleBottom);
            else if (r.top < 70) sc.scrollTop -= (70 - r.top);
          }
          document.addEventListener('focusin', function(e){
            const ov = ovEl();
            if (ov && ov.contains(e.target) && isTextField(e.target)) {
              lift(); [60, 150, 300, 500].forEach(function(ms){ setTimeout(lift, ms); });
            }
          });
          // Keyboard closing / tapping away: drop immediately (unless focus just moved to another box)
          document.addEventListener('focusout', function(){
            setTimeout(function(){
              const ov = ovEl(); const ae = document.activeElement;
              if (!(ov && ae && ov.contains(ae) && isTextField(ae))) release();
            }, 0);
          });
          if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', lift);
            window.visualViewport.addEventListener('scroll', lift);
          }
          window.addEventListener('resize', lift);
          if (navigator.virtualKeyboard) navigator.virtualKeyboard.addEventListener('geometrychange', lift);
        })();
