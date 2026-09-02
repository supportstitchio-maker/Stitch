const PUBLIC_PROFILES_TABLE = 'public_profiles';
        const CONNECTION_REQUESTS_TABLE = 'connection_requests';

        async function syncPublicProfile(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const user = await getCachedAuthUser();
            if (!user) return;
            const emailPrefix = (user.email || '').split('@')[0] || '';
            const name = (profileData.name || '').trim() || emailPrefix;
            if (!name) return; 
            await sb.from(PUBLIC_PROFILES_TABLE).upsert({
              user_id: user.id,
              name,
              username: (profileData.username || '').trim(),
              bio: profileData.bio || '',
              photo: profileData.photo || null,
              links: Array.isArray(profileData.links) ? profileData.links : [],
              updated_at: new Date().toISOString(),
            });
          } catch (e) { console.warn('Syncing public profile failed:', e); }
        }

        let profileData = {
          name: '',
          username: '',
          pronouns: '',
          bio: '',
          gender: '',
          photo: null,
          // True once the person has explicitly removed their photo (see
          // deleteProfilePicture below). Google sign-in used to re-fill an
          // empty photo from the Google account picture on every login --
          // harmless for a brand-new user, but it meant deliberately
          // deleting your photo never stuck: it would just quietly "come
          // back" the next time you logged in. This flag lets that
          // auto-fill (see applyGoogleProfileInfo) tell "never set one"
          // apart from "removed it on purpose".
          photoCleared: false,
          link: '',
          links: []
        };

        // Restores profileData to the same shape as its initial value above,
        // in place (same object reference, so anything that captured the
        // reference stays in sync). Used when logging into an account that
        // has no saved profile data yet, so the previous account's name,
        // photo, bio, etc. don't linger on screen.
        function resetProfileDataToDefault(){
          profileData.name = '';
          profileData.username = '';
          profileData.pronouns = '';
          profileData.bio = '';
          profileData.gender = '';
          profileData.photo = null;
          profileData.photoCleared = false;
          profileData.link = '';
          profileData.links = [];
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

        function renderProfile(){
          const screenEl = document.getElementById('screen');
          if (screenEl && document.getElementById('profile-tab-content')) {
            patchProfileHeaderInPlace();
            return;
          }
          screenEl.innerHTML = profileScreenHTML();
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
          usernameEl.innerHTML = `${escapeHtml(profileData.username)}`;
          photoEl.outerHTML = profilePhotoButtonHTML();
          nameEl.innerHTML = `${escapeHtml(profileData.name)} <span class="font-normal text-gray-400">${profileData.pronouns}</span>`;
          bioEl.textContent = profileData.bio;
          linksEl.innerHTML = profileLinksHTML(profileData.links);
          postsCountEl.textContent = myPostsCount();
          networkCountEl.textContent = networkConnectionCount();
          // The header fields above are patched individually, but the posts
          // grid below them was never refreshed here -- it kept whatever
          // thumbnails were last rendered into #profile-tab-content. That's
          // harmless when nothing's changed, but after signing out and into
          // a different account (a cached profile DOM node just gets
          // reattached, see switchTab in core.js) it meant the previous
          // account's post thumbnails stayed on screen even though the
          // posts *count* above correctly showed the new account's total.
          // Re-rendering the tab content here keeps the grid in sync with
          // whichever account's feedPosts are currently loaded.
          const tabsEl = document.getElementById('profile-tabs');
          const tabContentEl = document.getElementById('profile-tab-content');
          if (tabsEl) tabsEl.innerHTML = profileTabsHTML();
          if (tabContentEl) tabContentEl.innerHTML = profileTabContent();
        }

        function profilePhotoButtonHTML(){
          return `<button id="profile-photo-el" ${profileData.photo ? `onclick="viewProfilePhoto('${escapeForJsAttr(profileData.photo)}', '${escapeForJsAttr(profileData.name || '')}')"` : ''} class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center ${profileData.photo ? '' : `text-[${NAVY}]`}" style="${profileData.photo ? '' : 'background:rgba(10,37,64,0.14);'}">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-9 h-9')}</button>`;
        }

        function profileScreenHTML(){
          return `
          <div id="profile-screen-root">
            <div class="px-5 pb-3 flex items-center justify-between" style="padding-top:var(--top-safe-pad);">
              <button onclick="openOverlay('create')" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('plus','w-6 h-6'))}</button>
              <span id="profile-username-el" class="font-bold text-base font-display grad-text flex items-center gap-1.5">${escapeHtml(profileData.username)}</span>
              <div class="flex items-center rounded-full" style="background:rgba(65,105,225,0.08)">
                <button onclick="openOverlay('profileMenu')" class="w-8 h-8 flex items-center justify-center">${gradIcon(IconBold('settings','w-4 h-4'))}</button>
              </div>
            </div>

            <div class="p-5">
              <div class="flex items-center gap-5 mb-4">
                <div class="relative flex-shrink-0">
                  ${profilePhotoButtonHTML()}
                </div>
                <div class="flex-1">
                  <div id="profile-name-el" class="font-bold text-base mb-2">${escapeHtml(profileData.name)} <span class="font-normal text-gray-400">${profileData.pronouns}</span></div>
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
            </div>

            <div class="flex border-t border-gray-200" id="profile-tabs">${profileTabsHTML()}</div>
            <div class="px-5" id="profile-tab-content">${profileTabContent()}</div>
          </div>`;
        }

        let profileTab = 'posts';

        function profileTabsHTML(){
          const tabBtn = (key, icon) => `
            <button type="button" onclick="profileTabSwitch('${key}')" class="flex-1 flex justify-center py-3 ${profileTab === key ? `border-b-2 border-[${ROYAL}] text-[${NAVY}]` : 'text-gray-400'}" style="cursor:pointer;">${Icon(icon,'w-5 h-5')}</button>`;
          return tabBtn('posts','grid') + tabBtn('reposts','repost') + tabBtn('saved','bookmark');
        }

        function profileGridItem(post, source){
          const isMulti = !!(post.mediaHtml && /post-media-grid/.test(post.mediaHtml));
          let inner;
          let mediaType = null; 
          if (isMulti) {
            const firstTag = post.mediaHtml.match(/<(img|video)[^>]*\ssrc="([^"]+)"[^>]*>/i);
            if (firstTag) {
              mediaType = firstTag[1].toLowerCase() === 'video' ? 'video' : 'photo';
              inner = firstTag[0];
            } else {
              // Couldn't pull out the first tile's tag -- still a media post,
              // so default to "photo" rather than silently dropping the badge.
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
          // Badge sits on a small dark pill (not just a drop-shadowed icon) so it
          // reads clearly over bright/white photos too, and a title attribute
          // spells it out for anyone hovering on desktop -- the goal is that an
          // account owner can tell videos and photos apart at a glance.
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
          const items = feedPosts.filter(p => p.mine).sort(byNewestFirst);
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
              <div class="text-xs text-gray-500 mb-4">@${escapeHtml(profileData.username)}</div>
              <div class="flex items-center justify-center gap-6 mb-4">
                <div class="text-center"><div class="text-base font-bold">${myPostsCount()}</div><div class="text-[11px] text-gray-500">Posts</div></div>
                <button onclick="openOverlay('myContacts')" class="text-center"><div class="text-base font-bold">${networkConnectionCount()}</div><div class="text-[11px] text-gray-500">My Network</div></button>
              </div>
              ${profileData.bio ? `<div class="text-sm text-gray-600 mb-4">${escapeHtml(profileData.bio)}</div>` : ''}
              ${profileLinksHTML(profileData.links, { center: true })}
              <div class="flex gap-2">
                <button onclick="closeRightPanel();switchTab(4);" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">View full profile</button>
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
            <div class="p-5">
              <input id="discover-search-input" value="${escapeHtml(discoverSearchQuery)}" oninput="onDiscoverSearchInput(this.value)" placeholder="Search by name, school, field..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-5" autocomplete="off">
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
          if (content && typeof profileTabContent === 'function') content.innerHTML = profileTabContent();
        }

        function profileTabSwitch(tab){
          if (tab === profileTab) return;
          profileTab = tab;
          const bar = document.getElementById('profile-tabs');
          if (bar) bar.innerHTML = profileTabsHTML();
          const content = document.getElementById('profile-tab-content');
          if (content) content.innerHTML = profileTabContent();
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
              <input id="new-profile-link-input" type="text" value="${escapeHtml(newProfileLinkValue)}" oninput="newProfileLinkValue=this.value" placeholder="instagram.com/yourname" class="flex-1 min-w-0 text-[15px] border ${newProfileLinkError ? 'border-red-400' : 'border-gray-200'} bg-gray-50 rounded-2xl px-3 py-2.5" style="outline:none;">
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
          const avatarInner = p.photo
            ? `<img src="${p.photo}" class="w-full h-full object-cover">`
            : Icon('user','w-8 h-8');
          return `
            <div class="mb-5">
              <button onclick="discardEditProfileChanges()" class="w-9 h-9 -ml-2 mb-2 flex items-center justify-center text-gray-700">${Icon('back','w-5 h-5')}</button>
              <div class="text-xl font-bold text-gray-900 font-display mb-1">Edit Profile</div>
              <div class="text-sm text-gray-500">Update how your profile appears on Stitch.</div>
            </div>
            <div class="flex items-center gap-4 mb-5">
              <button onclick="viewProfilePhoto()" class="relative w-20 h-20 flex-shrink-0">
                <div class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center ${p.photo ? '' : `text-[${NAVY}]`}" style="${p.photo ? '' : 'background:rgba(10,37,64,0.14);'}">${avatarInner}</div>
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

            <div class="relative mb-5">
              <label class="text-sm font-bold text-gray-700 block mb-2">Pronouns</label>
              <button onclick="togglePronounsMenu()" class="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between text-left">
                <span class="text-[15px] ${p.pronouns ? '' : 'text-gray-400'}">${p.pronouns || 'Add pronouns'}</span>
                ${Icon('chevronDown','w-4 h-4 text-gray-500')}
              </button>
              ${pronounsMenuOpen ? `
                <div onclick="togglePronounsMenu()" onwheel="togglePronounsMenu()" ontouchmove="togglePronounsMenu()" class="fixed inset-0 z-10"></div>
                <div class="absolute left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="box-shadow:0 10px 30px rgba(0,0,0,.14);">
                  ${PRONOUN_OPTIONS.map(opt => `<button onclick="setPronouns('${opt}')" class="w-full text-left px-4 py-2.5 text-sm menu-item-pill ${p.pronouns===opt ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">${opt}</button>`).join('')}
                </div>
              ` : ''}
            </div>

            ${editBioField('edit-bio','Bio', p.bio, 'Write something about yourself')}

            <div class="mb-5">
              <label class="text-sm font-bold text-gray-700 block mb-2">Links</label>
              ${profileLinksEditHTML()}
            </div>

            <div class="mb-6">
              <label class="text-sm font-bold text-gray-700 block mb-2">Gender</label>
              <div onclick="toggleGenderMenu()" class="relative w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between text-left cursor-pointer">
                <span class="text-[15px]">${p.gender}</span>
                <div class="relative flex-shrink-0">
                  ${Icon('chevronDown','w-4 h-4 text-gray-500')}
                  ${genderMenuOpen ? `
                    <div onclick="event.stopPropagation(); toggleGenderMenu()" onwheel="event.stopPropagation(); toggleGenderMenu()" ontouchmove="event.stopPropagation(); toggleGenderMenu()" style="position:fixed;inset:0;z-index:30;"></div>
                    <div onclick="event.stopPropagation()" class="bg-white rounded-2xl border border-gray-100 py-2 text-left menu-dropdown-inset" style="position:absolute;right:0;top:100%;margin-top:0.5rem;width:9rem;z-index:40;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                      <button onclick="setGender('Male')" class="w-full text-left px-4 py-2.5 text-sm menu-item-pill ${p.gender==='Male' ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">Male</button>
                      <button onclick="setGender('Female')" class="w-full text-left px-4 py-2.5 text-sm menu-item-pill ${p.gender==='Female' ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">Female</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <button onclick="discardEditProfileChanges()" class="flex-1 py-3 rounded-2xl font-semibold text-sm border" style="color:#dc2626;border-color:rgba(220,38,38,0.25);background-image:linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(220,38,38,0.03) 100%);">Cancel</button>
              <button onclick="saveEditProfile()" class="flex-1 py-3 rounded-2xl font-semibold text-sm border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Save Changes</button>
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

        async function discardEditProfileChanges(fromPopState){
          if (pendingProfilePhotoUpload) { await pendingProfilePhotoUpload; pendingProfilePhotoUpload = null; }
          // Whether the photo actually changed while this modal was open --
          // picking/cropping a new photo (confirmPhotoCrop) already uploads
          // it to storage right away, and deleting one (deleteProfilePicture)
          // already stages an immediate-looking removal, so both *look*
          // committed the moment they happen. Reverting profileData.photo to
          // the pre-edit snapshot below used to silently throw that away
          // whenever the person left via the back arrow or "Cancel" instead
          // of explicitly tapping "Save Changes" -- the single most common
          // reason a newly-set profile picture "never showed up".
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
        }

        // Tracks the in-flight upload started by confirmPhotoCrop below, so
        // saveEditProfile/discardEditProfileChanges can wait for it instead
        // of racing it -- without this, tapping "Save Changes" (or the back
        // arrow) in the instant after picking a photo could persist the
        // large local base64 preview instead of the short storage URL, or
        // could act on a still-null profileData.photo before the upload
        // finished at all.
        let pendingProfilePhotoUpload = null;

        function confirmPhotoCrop(){
          if (!profilePhotoCropper) { closePhotoCropModal(); return; }
          const canvas = profilePhotoCropper.getCroppedCanvas({
            width: 640, height: 640, imageSmoothingQuality: 'high',
          });
          if (!canvas) { closePhotoCropModal(); return; }
          const previewDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          profileData.photo = previewDataUrl;
          profileData.photoCleared = false;
          closePhotoCropModal();
          renderEditProfileForm();
          pendingProfilePhotoUpload = new Promise(resolve => {
            canvas.toBlob(blob => {
              if (!blob) { resolve(); return; }
              uploadProfilePhotoToStorage(blob).then(remoteUrl => {
                if (!remoteUrl || profileData.photo !== previewDataUrl) { resolve(); return; }
                profileData.photo = remoteUrl;
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
              });
            }, 'image/jpeg', 0.9);
          });
        }

        function deleteProfilePicture(){
          if (!profileData.photo) return;
          openAppConfirmModal('Delete your profile picture?', '', 'Delete', function(){
            profileData.photo = null;
            profileData.photoCleared = true;
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
        async function saveEditProfile(){
          if (savingEditProfile) return;
          if (pendingProfilePhotoUpload) { await pendingProfilePhotoUpload; pendingProfilePhotoUpload = null; }
          const nameEl = document.getElementById('edit-name');
          const usernameEl = document.getElementById('edit-username');
          const newName = nameEl ? nameEl.value.trim() : profileData.name;
          const newUsername = usernameEl ? usernameEl.value.trim() : profileData.username;
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
          if (!hasError && newUsername) {
            savingEditProfile = true;
            const taken = await isUsernameTaken(newUsername);
            savingEditProfile = false;
            if (taken) {
              editUsernameError = 'That username is already taken. Please choose another.';
              hasError = true;
            }
          }
          if (hasError){
            renderEditProfileForm();
            return;
          }
          profileData.name = newName || profileData.name;
          profileData.username = newUsername || profileData.username;
          profileData.bio = document.getElementById('edit-bio').value.trim();
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

        // ---- Referrals screen ----
        function buildReferralInviteLink(code){
          return window.location.origin + window.location.pathname + '?ref=' + encodeURIComponent(code || referralCode || '');
        }

        function referralStatCard(value, label){
          return `
            <div class="flex-1 rounded-2xl py-4 text-center" style="border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
              <div class="text-xl font-bold font-display" style="color:${NAVY};">${value}</div>
              <div class="text-[11px] text-gray-500 mt-0.5">${label}</div>
            </div>`;
        }

        function referralsHTML(){
          if (!referralProfileLoaded && typeof loadReferralProfile === 'function') loadReferralProfile();
          const code = referralCode || '···· ····';
          const link = buildReferralInviteLink(referralCode);
          return `
            <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Referrals', '20px')}
              <div class="p-5">
                <div class="rounded-2xl p-5 mb-5 text-center text-white relative overflow-hidden" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">
                  <div class="text-xs font-bold uppercase tracking-wide text-white text-opacity-70 mb-1">Available credit</div>
                  <div class="text-3xl font-bold font-display">GHS ${referralPoints}</div>
                  <div class="text-xs text-white text-opacity-70 mt-1">${referralPoints} referral point${referralPoints===1?'':'s'} · 1 point = GHS 1</div>
                </div>
                <div class="flex gap-3 mb-5">
                  ${referralStatCard(referralCount, referralCount === 1 ? 'Friend referred' : 'Friends referred')}
                  ${referralStatCard(referralRedeemedPoints, 'Points redeemed')}
                </div>

                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your referral code</div>
                <div class="rounded-2xl flex items-center gap-2 mb-3" style="padding:14px 16px;border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                  <span class="flex-1 text-lg font-bold tracking-widest" style="color:${NAVY};">${escapeHtml(code)}</span>
                  <button onclick="copyReferralCode()" class="flex-shrink-0 p-2 rounded-full" style="color:${NAVY};border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">${Icon('copy','w-4 h-4')}</button>
                </div>

                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your referral link</div>
                <div class="rounded-2xl flex items-center gap-2 mb-3" style="padding:12px 14px;border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                  <span class="flex-1 text-sm font-semibold truncate" style="color:${NAVY};">${escapeHtml(link)}</span>
                  <button onclick="copyReferralLink()" class="flex-shrink-0 p-1.5 rounded-full" style="color:${NAVY};border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">${Icon('copy','w-4 h-4')}</button>
                </div>
                <button onclick="shareReferralLink()" class="w-full rounded-2xl font-bold text-center mb-5" style="padding-top:11px;padding-bottom:11px;border:1px solid rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;color:${NAVY};">Share invite link</button>

                <div class="text-xs text-gray-400 leading-relaxed">Share your code or link with a friend. When they register with it, you earn 1 point as a thank-you reward.</div>
              </div>
            </div>`;
        }

        function copyReferralCode(){
          if (!referralCode) { openAppAlertModal('Still generating your code -- try again in a moment.'); return; }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(referralCode).then(() => openAppAlertModal('Referral code copied to clipboard')).catch(() => openAppAlertModal(referralCode));
          } else {
            openAppAlertModal(referralCode);
          }
        }

        function copyReferralLink(){
          const link = buildReferralInviteLink(referralCode);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Referral link copied to clipboard')).catch(() => openAppAlertModal(link));
          } else {
            openAppAlertModal(link);
          }
        }

        function shareReferralLink(){
          const link = buildReferralInviteLink(referralCode);
          if (navigator.share) {
            navigator.share({ title: 'Join me on Stitch', text: 'Join me on Stitch -- use my referral code and we both benefit:', url: link }).catch(() => {});
          } else {
            copyReferralLink();
          }
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
                  <div class="font-bold text-lg font-display mb-3 tracking-wide text-[${NAVY}]">@${escapeHtml(profileData.username.toUpperCase())}</div>
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
            navigator.share({ title: profileData.name, text: `Check out @${escapeHtml(profileData.username)} on Stitch`, url: link }).catch(() => {});
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
            ctx.fillText('@' + profileData.username.toUpperCase(), out.width / 2, size + 80);
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
              ${overlayHeader('Settings and activity', '20px')}
              <div class="p-5">
              ${settingsSection('Your account', `
                ${settingsRow('chart','Your activity', null, "openOverlayFrom('profileMenu','profileAnalytics')")}
                ${settingsRow('bookmark','Saved', null, "openSavedItems('posts')")}
                ${settingsRow('close','Blocked', blockedAccounts.length ? `${blockedAccounts.length} account${blockedAccounts.length===1?'':'s'}` : 'No blocked accounts', "openOverlay('blockedAccounts')")}
                ${settingsToggleRow('theme','Theme', appPrefs.theme === 'dark' ? 'Dark mode' : 'Light mode', appPrefs.theme === 'dark', "toggleTheme()")}
              `)}
              <!-- Referrals hidden for now -- settingsSection('Referrals', ...) with
                   settingsRow('gift','Referrals', ...) removed from the list below.
                   referralsHTML()/loadReferralProfile() are left intact so this can
                   be turned back on later by re-adding the section. -->
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
